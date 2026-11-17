import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import type { Session } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { SessionStateBadge } from "../components/status-badge";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime, hostName, personaName, repositoryLabel, SESSION_STATES } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { useHosts, usePersonas, useSessions } from "../queries";
import { type SessionAction, SessionActionDialogs, STOPPABLE } from "./session-actions";

const ROUTE = "/t/$tenantId/sessions";

const TableSkeleton = () => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-3">
    {[0, 1, 2, 3, 4].map((row) => (
      <Skeleton key={row} className="h-7 w-full" />
    ))}
  </div>
);

const RowActions = ({ session, onPick }: { session: Session; onPick: (hash: string) => void }) => {
  if (STOPPABLE.has(session.state)) {
    return (
      <Button size="sm" variant="outline" onClick={() => onPick(`stop-${session.sessionId}`)}>
        Stop
      </Button>
    );
  }
  if (session.state === "Stopped") {
    return (
      <Button size="sm" variant="outline" onClick={() => onPick(`archive-${session.sessionId}`)}>
        Archive
      </Button>
    );
  }
  return null;
};

const pendingAction = (hash: string): { action: SessionAction; sessionId: string } | null => {
  for (const action of ["stop", "archive"] as const) {
    if (hash.startsWith(`${action}-`)) return { action, sessionId: hash.slice(action.length + 1) };
  }
  return null;
};

export const SessionsListScreen = () => {
  const { tenantId } = useParams({ from: ROUTE });
  const { state: chosen, hostId: hostIds } = useSearch({ from: ROUTE });
  const dialog = useHashDialog();
  const navigate = useNavigate({ from: ROUTE });
  const sessions = useSessions(tenantId);
  const hosts = useHosts(tenantId);
  const personas = usePersonas(tenantId);
  const hostId = hostIds[0] ?? "";
  const pending = pendingAction(dialog.hash);
  const setSearch = (state: Session["state"][], host: string) =>
    void navigate({ search: { state, hostId: host === "" ? [] : [host] } });
  const toggle = (state: Session["state"]) =>
    setSearch(chosen.includes(state) ? chosen.filter((item) => item !== state) : [...chosen, state], hostId);
  const pick = (next: string) => void navigate({ search: (search) => search, hash: next });
  const start = (
    <Button asChild>
      <Link
        to="/t/$tenantId/sessions/new"
        params={{ tenantId }}
        search={{ source: [], persona: [], repo: [], issue: [], model: [], prompt: [] }}
      >
        Start session
      </Link>
    </Button>
  );
  const body = () => {
    if (sessions.isPending) return <TableSkeleton />;
    if (sessions.isError) return <ProblemBlock error={sessions.error} onRetry={() => void sessions.refetch()} />;
    if (sessions.data.length === 0) {
      return (
        <EmptyState
          title="No sessions yet"
          detail="Pick a persona, a repository and a prompt, and a box starts work on it."
          action={start}
        />
      );
    }
    const rows = sessions.data
      .filter((session) => chosen.length === 0 || chosen.includes(session.state))
      .filter((session) => hostId === "" || session.hostId === hostId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (rows.length === 0) {
      return (
        <div className="grid justify-items-start gap-2 rounded-lg border bg-card p-6">
          <p className="font-medium">
            No {chosen.join(" or ")} sessions{hostId === "" ? "" : ` on ${hostName(hosts.data ?? [], hostId)}`}
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearch([], "")}>
            Clear filter
          </Button>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {hosts.isError && <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />}
        {personas.isError && <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repository</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((session) => (
              <TableRow key={session.sessionId}>
                <TableCell>
                  <Link
                    to="/t/$tenantId/sessions/$sessionId"
                    params={{ tenantId, sessionId: session.sessionId }}
                    className="font-medium hover:underline"
                  >
                    {repositoryLabel(session.repository)}
                  </Link>
                </TableCell>
                <TableCell>{personaName(personas.data ?? [], session.personaId)}</TableCell>
                <TableCell>
                  <SessionStateBadge state={session.state} />
                </TableCell>
                <TableCell>{hostName(hosts.data ?? [], session.hostId)}</TableCell>
                <TableCell>{formatTime(session.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <RowActions session={session} onPick={pick} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">Sorted by last change, newest first.</p>
        {pending !== null && (
          <SessionActionDialogs
            tenantId={tenantId}
            sessionId={pending.sessionId}
            action={pending.action}
            onClose={dialog.close}
          />
        )}
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Sessions" actions={start} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filter by state</legend>
          {SESSION_STATES.map((state) => {
            const on = chosen.includes(state);
            return (
              <button
                key={state}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(state)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {state}
                {on && <XIcon className="size-3" aria-hidden />}
              </button>
            );
          })}
        </fieldset>
        <NativeSelect
          aria-label="Filter by host"
          className="w-44"
          value={hostId}
          onChange={(event) => setSearch(chosen, event.target.value)}
        >
          <option value="">Any host</option>
          {(hosts.data ?? []).map((host) => (
            <option key={host.hostId} value={host.hostId}>
              {host.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {body()}
    </>
  );
};
