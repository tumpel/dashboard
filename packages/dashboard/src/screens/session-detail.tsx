import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Session, TranscriptText, Turn } from "../api/port";
import { UNRECOGNISED_LABEL } from "../api/wording";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { TriggerOriginNote } from "../components/started-by";
import { SessionStateBadge } from "../components/status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useSignedOut, useTenantApi } from "../context";
import { formatMib, formatTime, HARNESS_NAMES, hostName, personaName, repositoryLabel } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { shortDigest } from "../prebuild-rows";
import {
  keys,
  useCredentialHandovers,
  useHarnessCatalog,
  useHosts,
  usePersonas,
  useSession,
  useSnapshots,
  useStopFailures,
  useTriggers,
  useTurns,
} from "../queries";
import { type TranscriptView, useTranscript } from "../transcript";
import { ARCHIVABLE, SessionActionDialogs, STOPPABLE } from "./session-actions";
import { SessionCostTab } from "./session-cost";
import { SessionStartupCard } from "./session-startup";

const ROUTE = "/t/$tenantId/sessions/$sessionId/turns/$turnId";

export const SESSION_TABS = ["startup", "cost", "snapshots", "handovers", "stop-failures"] as const;
type SessionTab = (typeof SESSION_TABS)[number] | "transcript";

const TAB_LABELS: [SessionTab, string][] = [
  ["transcript", "Transcript"],
  ["startup", "Startup"],
  ["cost", "Cost"],
  ["snapshots", "Snapshots"],
  ["handovers", "Handovers"],
  ["stop-failures", "Stop failures"],
];

const SENDABLE: ReadonlySet<Session["state"]> = new Set(["Idle", "Stopped"]);
const IN_FLIGHT: ReadonlySet<Turn["state"]> = new Set(["Offered", "Running"]);

const turnLabel = (turns: readonly Turn[], turnId: string): string => {
  const index = turns.findIndex((turn) => turn.turnId === turnId);
  return index === -1 ? "Turn" : `Turn ${index + 1}`;
};

const crumbFor = (tenantId: string) => (
  <Link
    to="/t/$tenantId/sessions"
    params={{ tenantId }}
    search={{ state: [], hostId: [], trigger: [] }}
    className="hover:underline"
  >
    Sessions /
  </Link>
);

const SessionsLink = ({ tenantId }: { tenantId: string }) => (
  <Button size="sm" variant="outline" asChild>
    <Link to="/t/$tenantId/sessions" params={{ tenantId }} search={{ state: [], hostId: [], trigger: [] }}>
      Open Sessions
    </Link>
  </Button>
);

export const SessionLatestTurn = () => {
  const { tenantId, sessionId } = useParams({ from: "/t/$tenantId/sessions/$sessionId" });
  const turns = useTurns(tenantId, sessionId);
  if (turns.isPending) {
    return (
      <>
        <PageHeader title="Session" crumb={crumbFor(tenantId)} />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }
  if (turns.isError) {
    return (
      <>
        <PageHeader title="Session" crumb={crumbFor(tenantId)} />
        <ProblemBlock
          error={turns.error}
          onRetry={() => void turns.refetch()}
          actions={<SessionsLink tenantId={tenantId} />}
        />
      </>
    );
  }
  const latest = turns.data.at(-1);
  if (latest === undefined) {
    return (
      <>
        <PageHeader title="Session" crumb={crumbFor(tenantId)} />
        <EmptyState
          title="This session has no turn"
          detail="A session answers its first turn when it starts. One without a turn did not start."
          action={<SessionsLink tenantId={tenantId} />}
        />
      </>
    );
  }
  return (
    <Navigate
      to="/t/$tenantId/sessions/$sessionId/turns/$turnId"
      params={{ tenantId, sessionId, turnId: latest.turnId }}
      search={{ compact: [], tab: [] }}
      replace
    />
  );
};

const TurnsColumn = ({
  tenantId,
  sessionId,
  turns,
  turnId,
  compact,
}: {
  tenantId: string;
  sessionId: string;
  turns: Turn[];
  turnId: string;
  compact: ("0" | "1")[];
}) => (
  <nav aria-label="Turns" className="grid content-start gap-1 rounded-lg border bg-muted p-2">
    <h2 className="px-2 pt-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Turns</h2>
    {turns.map((turn, index) => (
      <Link
        key={turn.turnId}
        to="/t/$tenantId/sessions/$sessionId/turns/$turnId"
        params={{ tenantId, sessionId, turnId: turn.turnId }}
        search={{ compact, tab: [] }}
        aria-current={turn.turnId === turnId ? "page" : undefined}
        className={cn(
          "grid rounded-md px-2 py-1.5 text-sm hover:bg-accent",
          turn.turnId === turnId && "bg-accent font-semibold",
        )}
      >
        <span>Turn {index + 1}</span>
        <span
          className={cn("text-sm text-muted-foreground", turn.state === "Failed" && "font-semibold text-destructive")}
        >
          {turn.state}, {turn.lineCount} lines
        </span>
      </Link>
    ))}
  </nav>
);

const TranscriptLines = ({ prompt, lines }: { prompt: string; lines: TranscriptText[] }) => (
  <ol className="grid gap-1.5 font-mono text-sm">
    <li className="grid grid-cols-[4rem_1fr] gap-2">
      <span className="text-sm text-muted-foreground">prompt</span>
      <span className="font-semibold whitespace-pre-wrap">{prompt}</span>
    </li>
    {lines.map(({ lineSeq, text }) => (
      <li key={lineSeq} className="grid grid-cols-[4rem_1fr] gap-2">
        <span />
        <span className="break-words whitespace-pre-wrap">{text}</span>
      </li>
    ))}
  </ol>
);

const TurnFailureBlock = ({ label, turn }: { label: string; turn: Extract<Turn, { state: "Failed" }> }) => (
  <ProblemCard
    wording={{
      title: `${label} failed: ${turn.reason}`,
      detail: turn.detail,
      fix: "Fix what the detail names, then send the next prompt to start a new turn.",
    }}
  />
);

const TranscriptPanel = ({
  tenantId,
  session,
  turn,
  label,
  compactable,
  compact,
  onCompact,
}: {
  tenantId: string;
  session: Session;
  turn: Turn;
  label: string;
  compactable: boolean;
  compact: boolean;
  onCompact: (compact: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const signedOut = useSignedOut();
  const transcript = useTranscript(tenantId, session.sessionId, turn.turnId, compact);
  const scroller = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const view = transcript.data;
  const lineCount = view?.lines.length ?? 0;
  const finished = view?.finished ?? false;
  const turnInFlight = IN_FLIGHT.has(turn.state);
  useEffect(() => {
    if (!finished || !turnInFlight) return;
    void queryClient.invalidateQueries({ queryKey: keys.turns(tenantId, session.sessionId) });
    void queryClient.invalidateQueries({ queryKey: keys.session(tenantId, session.sessionId), exact: true });
    void queryClient.invalidateQueries({ queryKey: keys.sessions(tenantId), exact: true });
  }, [finished, turnInFlight, queryClient, tenantId, session.sessionId]);
  useEffect(() => {
    const element = scroller.current;
    if (element !== null && following && lineCount > 0) element.scrollTop = element.scrollHeight;
  }, [lineCount, following]);
  const resume = () => {
    queryClient.setQueryData<TranscriptView>(
      keys.transcript(tenantId, session.sessionId, turn.turnId, compact),
      (current) => current && { ...current, idleReads: 0 },
    );
    void transcript.refetch();
  };
  const jump = () => {
    setFollowing(true);
    const element = scroller.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  };
  const footer = (): ReactNode => {
    if (signedOut) return <span className="font-semibold">Reads stopped: signed out.</span>;
    if (transcript.isError) return <span className="font-semibold">Reads paused at line {view?.cursor ?? 0}.</span>;
    if (finished && session.state === "Stopping") {
      return (
        <span className="flex items-center gap-2">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          Taking the last snapshot...
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: keys.session(tenantId, session.sessionId),
                exact: true,
              })
            }
          >
            Refresh
          </Button>
        </span>
      );
    }
    if (finished) return <span className="text-muted-foreground">Finished.</span>;
    if (view?.unrecognised) {
      return <span className="font-semibold">Reads stopped: reload the page to update the dashboard.</span>;
    }
    return (
      <span className="flex items-center gap-2 font-semibold">
        <span className="size-2 rounded-full bg-primary" aria-hidden />
        Reading live
      </span>
    );
  };
  return (
    <div className="grid gap-3">
      <section aria-label={`${label} transcript`} className="grid rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="flex items-baseline gap-2">
            <h2 className="font-semibold">{label}</h2>
            <span role="status" className="text-sm text-muted-foreground">
              {turn.state}, {lineCount} lines shown
            </span>
          </div>
          {compactable && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={compact} onChange={(event) => onCompact(event.target.checked)} />
              Compact
            </label>
          )}
        </div>
        <div
          ref={scroller}
          onScroll={(event) => {
            const element = event.currentTarget;
            setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight < 24);
          }}
          className="max-h-[60vh] min-h-48 overflow-y-auto px-3 py-3"
        >
          {transcript.isPending ? (
            <div aria-busy className="grid gap-2">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} className="h-4" style={{ width: `${40 + ((row * 7) % 5) * 10}%` }} />
              ))}
            </div>
          ) : (
            <TranscriptLines prompt={turn.prompt} lines={view?.lines ?? []} />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm">
          {footer()}
          {!following && (
            <Button size="sm" variant="ghost" onClick={jump}>
              Jump to latest
            </Button>
          )}
        </div>
      </section>
      {transcript.isError && !signedOut && (
        <ProblemBlock error={transcript.error} retryLabel="Resume" onRetry={resume} />
      )}
      {finished && turn.state === "Failed" && <TurnFailureBlock label={label} turn={turn} />}
    </div>
  );
};

const composerHint = (session: Session): string => {
  if (session.state === "Idle") return "Ctrl Enter sends. The session is Idle.";
  if (session.state === "Stopped") return "A send boots a fresh box from the last snapshot.";
  if (session.state === "Stopping") return "The session takes no prompts while it stops.";
  if (session.state === "Failed") return "The repository could not be cloned. Start a new session.";
  return "Steer hands the prompt to the running turn. Send unlocks when the turn finishes.";
};

const Composer = ({
  tenantId,
  session,
  running,
  compact,
}: {
  tenantId: string;
  session: Session;
  running: Turn | undefined;
  compact: ("0" | "1")[];
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const send = useMutation({
    mutationFn: (prompt: string) => api.sendTurn(session.sessionId, prompt),
    onSuccess: (turn) => {
      setDraft("");
      queryClient.setQueryData<Turn[]>(keys.turns(tenantId, session.sessionId), (turns) => [...(turns ?? []), turn]);
      void queryClient.invalidateQueries({ queryKey: keys.session(tenantId, session.sessionId), exact: true });
      void queryClient.invalidateQueries({ queryKey: keys.sessions(tenantId), exact: true });
      void navigate({
        to: "/t/$tenantId/sessions/$sessionId/turns/$turnId",
        params: { tenantId, sessionId: session.sessionId, turnId: turn.turnId },
        search: { compact, tab: [] },
      });
    },
  });
  const steer = useMutation({
    mutationFn: ({ turnId, prompt }: { turnId: string; prompt: string }) => api.steerTurn(turnId, prompt),
    onSuccess: () => setDraft(""),
  });
  const sendable = SENDABLE.has(session.state) && draft.trim() !== "" && !send.isPending;
  const steerable = running?.state === "Running" && draft.trim() !== "" && !steer.isPending;
  const submit = () => {
    if (sendable) send.mutate(draft.trim());
  };
  return (
    <div className="grid gap-2">
      <div className={cn("grid gap-2 rounded-lg border bg-card p-3", send.isError && "border-2 border-destructive")}>
        <Textarea
          aria-label="Next prompt"
          rows={3}
          disabled={session.state === "Stopping" || session.state === "Failed"}
          placeholder={SENDABLE.has(session.state) ? "Next prompt" : "Write the next prompt while the turn runs"}
          value={draft}
          onChange={(event) => {
            send.reset();
            steer.reset();
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{composerHint(session)}</span>
          <div className="flex gap-2">
            {running?.state === "Running" && (
              <Button
                size="sm"
                variant="outline"
                disabled={!steerable}
                title="The running turn reads this after its next step and keeps working"
                onClick={() => steer.mutate({ turnId: running.turnId, prompt: draft.trim() })}
              >
                {steer.isPending ? "Steering..." : "Steer"}
              </Button>
            )}
            <Button size="sm" disabled={!sendable} onClick={submit}>
              {send.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
      {send.isError && <ProblemBlock error={send.error} />}
      {steer.isError && <ProblemBlock error={steer.error} />}
      {steer.isSuccess && (
        <p className="text-xs text-muted-foreground">The running turn reads your steer after its next step.</p>
      )}
    </div>
  );
};

const layerText = (layer: NonNullable<Session["prebuildLayer"]>): string =>
  layer.layer === "Prebuild"
    ? `The session's files start from prebuild layer ${shortDigest(layer.layerDigest)}.`
    : `The session's files start without a prebuild: ${layer.detail}.`;

const imageText = (image: NonNullable<Session["lastTurnImage"]>): string => {
  if (image.kind === "Full") return `The latest turn boots guest image ${shortDigest(image.guestImageDigest)}.`;
  if (image.kind === "Unrecognised") return `The latest turn boots an image of kind ${UNRECOGNISED_LABEL}.`;
  return `The latest turn boots base image ${shortDigest(image.baseImageDigest)} with harness layer ${shortDigest(image.harnessLayerDigest)}.`;
};

const BootNote = ({ session }: { session: Session }) => {
  const lines = [
    session.prebuildLayer && layerText(session.prebuildLayer),
    session.lastTurnImage && imageText(session.lastTurnImage),
  ].filter((line) => line !== undefined);
  if (lines.length === 0) return null;
  return <p className="mb-4 text-sm text-muted-foreground">{lines.join(" ")}</p>;
};

const ArchivedNote = () => (
  <div className="rounded-lg border bg-muted p-3">
    <p className="font-semibold">Archived. The transcript stays readable; sends are refused.</p>
    <p className="text-sm">Start a new session on the same repository to continue.</p>
  </div>
);

const TabPanel = ({ query, children }: { query: UseQueryResult<unknown>; children: ReactNode }) => {
  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError) return <ProblemBlock error={query.error} onRetry={() => void query.refetch()} />;
  return children;
};

const SnapshotsTab = ({ tenantId, sessionId, turns }: { tenantId: string; sessionId: string; turns: Turn[] }) => {
  const snapshots = useSnapshots(tenantId, sessionId);
  const rows = [...(snapshots.data ?? [])].sort((a, b) => b.snapshotSeq - a.snapshotSeq);
  return (
    <TabPanel query={snapshots}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No snapshots yet. A turn's box is snapshotted when the turn ends.
        </p>
      ) : (
        <Table mobile>
          <TableHeader>
            <TableRow>
              <TableHead>Seq</TableHead>
              <TableHead>Turn</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((snapshot) => (
              <TableRow key={snapshot.snapshotId}>
                <TableCell label="Seq">{snapshot.snapshotSeq}</TableCell>
                <TableCell mobile="primary">{turnLabel(turns, snapshot.turnId)}</TableCell>
                <TableCell mobile="summary">
                  {snapshot.outcome.state === "Stored" ? (
                    <Badge variant="success">Stored</Badge>
                  ) : snapshot.outcome.state === "Unrecognised" ? (
                    <Badge variant="outline">{UNRECOGNISED_LABEL}</Badge>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">Failed</Badge>
                      <span className="text-sm">
                        {snapshot.outcome.reason}: {snapshot.outcome.detail}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell label="Uploaded">
                  {snapshot.outcome.state === "Stored"
                    ? formatMib(Math.round((snapshot.outcome.uploadedBytes / 1024 ** 2) * 10) / 10)
                    : ""}
                </TableCell>
                <TableCell label="When">{formatTime(snapshot.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TabPanel>
  );
};

const HandoversTab = ({
  tenantId,
  sessionId,
  turns,
  hostNameOf,
}: {
  tenantId: string;
  sessionId: string;
  turns: Turn[];
  hostNameOf: (hostId: string) => string;
}) => {
  const handovers = useCredentialHandovers(tenantId, sessionId);
  const rows = [...(handovers.data ?? [])].reverse();
  return (
    <TabPanel query={handovers}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No credential handovers yet.</p>
      ) : (
        <div className="grid gap-2">
          <Table mobile>
            <TableHeader>
              <TableRow>
                <TableHead>Turn</TableHead>
                <TableHead>Variables handed over</TableHead>
                <TableHead>Repository token</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((handover) => (
                <TableRow key={handover.credentialHandoverId}>
                  <TableCell mobile="primary">{turnLabel(turns, handover.turnId)}</TableCell>
                  <TableCell label="Variables handed over" className="font-mono text-[13px]">
                    {handover.variableNames.join(", ")}
                  </TableCell>
                  <TableCell mobile="summary">{handover.repositoryCredentialSource}</TableCell>
                  <TableCell label="Host">{hostNameOf(handover.hostId)}</TableCell>
                  <TableCell label="When">{formatTime(handover.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Names only. Values are never recorded or shown.</p>
        </div>
      )}
    </TabPanel>
  );
};

const StopFailuresTab = ({ tenantId, sessionId }: { tenantId: string; sessionId: string }) => {
  const failures = useStopFailures(tenantId, sessionId);
  const rows = [...(failures.data ?? [])].reverse();
  return (
    <TabPanel query={failures}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stop failures.</p>
      ) : (
        <div className="grid gap-2">
          <Table mobile>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((failure) => (
                <TableRow key={failure.stopFailureId}>
                  <TableCell mobile="primary">{failure.reason}</TableCell>
                  <TableCell label="Detail" className="whitespace-normal">
                    {failure.detail}
                  </TableCell>
                  <TableCell mobile="summary">{failure.failedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm">A failed stop returns the session to Idle. Stop again once the host is Online.</p>
        </div>
      )}
    </TabPanel>
  );
};

const SessionTabs = ({ tab, onPick }: { tab: SessionTab; onPick: (tab: SessionTab) => void }) => (
  <div role="tablist" aria-label="Session" className="mb-4 grid grid-cols-3 gap-1 border-b sm:flex">
    {TAB_LABELS.map(([value, label]) => (
      <button
        key={value}
        type="button"
        role="tab"
        aria-selected={tab === value}
        onClick={() => onPick(value)}
        className={cn(
          "-mb-px border-b-2 px-1 py-2 text-sm whitespace-nowrap sm:px-3",
          tab === value ? "border-primary font-semibold" : "border-transparent text-muted-foreground",
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

export const SessionDetailScreen = () => {
  const { tenantId, sessionId, turnId } = useParams({ from: ROUTE });
  const search = useSearch({ from: ROUTE });
  const dialog = useHashDialog();
  const navigate = useNavigate({ from: ROUTE });
  const session = useSession(tenantId, sessionId);
  const turns = useTurns(tenantId, sessionId);
  const personas = usePersonas(tenantId);
  const hosts = useHosts(tenantId);
  const catalog = useHarnessCatalog(tenantId);
  const triggers = useTriggers(tenantId);
  const crumb = crumbFor(tenantId);
  if (session.isPending || turns.isPending || catalog.isPending) {
    return (
      <>
        <PageHeader title="Session" crumb={crumb} />
        <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }
  if (session.isError || turns.isError || catalog.isError) {
    const failed = session.isError ? session : turns.isError ? turns : catalog;
    return (
      <>
        <PageHeader title="Session" crumb={crumb} />
        <ProblemBlock
          error={failed.error}
          onRetry={() => void failed.refetch()}
          actions={<SessionsLink tenantId={tenantId} />}
        />
      </>
    );
  }
  const data = session.data;
  const turnList = turns.data;
  const turn = turnList.find((item) => item.turnId === turnId);
  const tab: SessionTab = search.tab[0] ?? "transcript";
  const compactable = catalog.data.some((entry) => entry.harness === data.harness && entry.compactTranscript);
  const compact = compactable && search.compact[0] !== "0";
  const label = turnLabel(turnList, turnId);
  const hostNameOf = (hostId: string) => hostName(hosts.data ?? [], hostId);
  const actions =
    data.state === "Archived" ? undefined : (
      <>
        <Button
          variant="outline"
          disabled={!ARCHIVABLE.has(data.state)}
          title={ARCHIVABLE.has(data.state) ? undefined : "Wait until the session reads Idle or Stopped"}
          onClick={() => void navigate({ search: (current) => current, hash: "archive" })}
        >
          Archive
        </Button>
        {(STOPPABLE.has(data.state) || data.state === "Running") && (
          <Button variant="destructive" onClick={() => void navigate({ search: (current) => current, hash: "stop" })}>
            {data.state === "Running" ? "Cancel turn and stop" : "Stop session"}
          </Button>
        )}
      </>
    );
  const transcriptTab = () => {
    if (turn === undefined) {
      return (
        <EmptyState
          title="No such turn in this session"
          detail={`Turn ${turnId} is not one of this session's turns.`}
          action={
            <Button asChild>
              <Link to="/t/$tenantId/sessions/$sessionId" params={{ tenantId, sessionId }}>
                Open the latest turn
              </Link>
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
        <TurnsColumn
          tenantId={tenantId}
          sessionId={sessionId}
          turns={turnList}
          turnId={turnId}
          compact={search.compact}
        />
        <div className="grid min-w-0 content-start gap-3">
          <SessionStartupCard tenantId={tenantId} session={data} turns={turnList} turnId={turnId} />
          <TranscriptPanel
            key={`${turnId}-${compact}`}
            tenantId={tenantId}
            session={data}
            turn={turn}
            label={label}
            compactable={compactable}
            compact={compact}
            onCompact={(next) =>
              void navigate({ search: (current) => ({ ...current, compact: [next ? "1" : "0"] }), replace: true })
            }
          />
          {data.state === "Archived" ? (
            <ArchivedNote />
          ) : (
            <Composer
              tenantId={tenantId}
              session={data}
              running={turnList.find((turn) => IN_FLIGHT.has(turn.state))}
              compact={search.compact}
            />
          )}
        </div>
      </div>
    );
  };
  return (
    <>
      <PageHeader title={repositoryLabel(data.repository)} crumb={crumb} actions={actions} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SessionStateBadge state={data.state} />
        <span>
          {personaName(personas.data ?? [], data.personaId)} / {HARNESS_NAMES[data.harness]} {data.harnessVersion} /{" "}
          {data.model} / {hostNameOf(data.hostId)}
        </span>
      </div>
      <TriggerOriginNote tenantId={tenantId} startedBy={data.startedBy} triggers={triggers.data ?? []} />
      <BootNote session={data} />
      {personas.isError && (
        <ProblemBlock className="mb-4" error={personas.error} onRetry={() => void personas.refetch()} />
      )}
      {triggers.isError && (
        <ProblemBlock className="mb-4" error={triggers.error} onRetry={() => void triggers.refetch()} />
      )}
      <SessionTabs
        tab={tab}
        onPick={(next) =>
          void navigate({ search: (current) => ({ ...current, tab: next === "transcript" ? [] : [next] }) })
        }
      />
      {tab === "transcript" && transcriptTab()}
      {tab === "startup" && <SessionStartupCard tenantId={tenantId} session={data} turns={turnList} />}
      {tab === "cost" && <SessionCostTab tenantId={tenantId} session={data} turns={turnList} />}
      {tab === "snapshots" && <SnapshotsTab tenantId={tenantId} sessionId={sessionId} turns={turnList} />}
      {tab === "handovers" && (
        <HandoversTab tenantId={tenantId} sessionId={sessionId} turns={turnList} hostNameOf={hostNameOf} />
      )}
      {tab === "stop-failures" && <StopFailuresTab tenantId={tenantId} sessionId={sessionId} />}
      <SessionActionDialogs
        tenantId={tenantId}
        sessionId={sessionId}
        action={dialog.isOpen("stop") ? "stop" : dialog.isOpen("archive") ? "archive" : null}
        running={data.state === "Running"}
        onClose={dialog.close}
      />
    </>
  );
};
