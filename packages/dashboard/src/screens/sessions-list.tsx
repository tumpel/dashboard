import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useState } from "react";
import type { Session } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { StartedBy } from "../components/started-by";
import { SessionStateBadge } from "../components/status-badge";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime, hostName, personaName, repositoryLabel, SESSION_STATES } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { useHosts, useMembers, usePersonas, useSessions, useTriggers } from "../queries";
import {
  ARCHIVABLE,
  ArchiveSessionsDialog,
  type SessionAction,
  SessionActionDialogs,
  STOPPABLE,
} from "./session-actions";

const ROUTE = "/t/$tenantId/sessions";

const TableSkeleton = () => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-3">
    {[0, 1, 2, 3, 4].map((row) => (
      <Skeleton key={row} className="h-7 w-full" />
    ))}
  </div>
);

const RowActions = ({ session, onPick }: { session: Session; onPick: (hash: string) => void }) => (
  <div className="flex justify-end gap-2">
    {STOPPABLE.has(session.state) && (
      <Button size="sm" variant="outline" onClick={() => onPick(`stop-${session.sessionId}`)}>
        Stop
      </Button>
    )}
    {ARCHIVABLE.has(session.state) && (
      <Button size="sm" variant="outline" onClick={() => onPick(`archive-${session.sessionId}`)}>
        Archive
      </Button>
    )}
  </div>
);

const pendingAction = (hash: string): { action: SessionAction; sessionId: string } | null => {
  for (const action of ["stop", "archive"] as const) {
    if (hash.startsWith(`${action}-`)) return { action, sessionId: hash.slice(action.length + 1) };
  }
  return null;
};

export const SessionsListScreen = () => {
  const { tenantId } = useParams({ from: ROUTE });
  const { state: chosen, hostId: hostIds, trigger: triggerIds } = useSearch({ from: ROUTE });
  const dialog = useHashDialog();
  const navigate = useNavigate({ from: ROUTE });
  const sessions = useSessions(tenantId, triggerIds[0] ?? null);
  const hosts = useHosts(tenantId);
  const personas = usePersonas(tenantId);
  const members = useMembers(tenantId);
  const triggers = useTriggers(tenantId);
  const hostId = hostIds[0] ?? "";
  const triggerId = triggerIds[0] ?? "";
  const pending = pendingAction(dialog.hash);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const select = (sessionIds: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const sessionId of sessionIds) {
        if (on) next.add(sessionId);
        else next.delete(sessionId);
      }
      return next;
    });
  const setSearch = (state: Session["state"][], host: string, trigger: string) =>
    void navigate({ search: { state, hostId: host === "" ? [] : [host], trigger: trigger === "" ? [] : [trigger] } });
  const toggle = (state: Session["state"]) =>
    setSearch(chosen.includes(state) ? chosen.filter((item) => item !== state) : [...chosen, state], hostId, triggerId);
  const triggerNameOf = (id: string): string => triggers.data?.find((trigger) => trigger.triggerId === id)?.name ?? id;
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
    if (sessions.data.length === 0 && triggerId === "") {
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
            {triggerId === "" ? "" : ` started by trigger ${triggerNameOf(triggerId)}`}
          </p>
          <Button variant="outline" size="sm" onClick={() => setSearch([], "", "")}>
            Clear filter
          </Button>
        </div>
      );
    }
    const selectable = rows.filter((session) => ARCHIVABLE.has(session.state)).map((session) => session.sessionId);
    const picked = rows.filter((session) => ARCHIVABLE.has(session.state) && selected.has(session.sessionId));
    const allPicked = selectable.length > 0 && selectable.every((sessionId) => selected.has(sessionId));
    return (
      <div className="grid gap-3">
        {picked.length > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2 pl-3">
            <p className="text-sm font-medium">{picked.length} selected</p>
            <Button size="sm" variant="destructive" onClick={() => setArchiving(true)}>
              Archive selected
            </Button>
          </div>
        )}
        <Table mobile>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select every session shown that can be archived"
                  checked={allPicked}
                  disabled={selectable.length === 0}
                  onChange={(event) => select(selectable, event.target.checked)}
                />
              </TableHead>
              <TableHead>Repository</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Started by</TableHead>
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
                <TableCell label="Select">
                  {ARCHIVABLE.has(session.state) && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${repositoryLabel(session.repository)}`}
                      checked={selected.has(session.sessionId)}
                      onChange={(event) => select([session.sessionId], event.target.checked)}
                    />
                  )}
                </TableCell>
                <TableCell mobile="primary">
                  <Link
                    to="/t/$tenantId/sessions/$sessionId"
                    params={{ tenantId, sessionId: session.sessionId }}
                    className="font-medium hover:underline"
                  >
                    {repositoryLabel(session.repository)}
                  </Link>
                </TableCell>
                <TableCell label="Persona">{personaName(personas.data ?? [], session.personaId)}</TableCell>
                <TableCell label="Started by">
                  <StartedBy
                    tenantId={tenantId}
                    startedBy={session.startedBy}
                    members={members.data ?? []}
                    triggers={triggers.data ?? []}
                  />
                </TableCell>
                <TableCell mobile="state">
                  <SessionStateBadge state={session.state} />
                </TableCell>
                <TableCell label="Host">{hostName(hosts.data ?? [], session.hostId)}</TableCell>
                <TableCell label="Updated">{formatTime(session.updatedAt)}</TableCell>
                <TableCell mobile="action" className="text-right">
                  <RowActions session={session} onPick={pick} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">Sorted by last change, newest first.</p>
        {archiving && (
          <ArchiveSessionsDialog
            tenantId={tenantId}
            sessions={picked}
            onClose={() => setArchiving(false)}
            onArchived={() =>
              select(
                picked.map((session) => session.sessionId),
                false,
              )
            }
          />
        )}
        {pending !== null && (
          <SessionActionDialogs
            tenantId={tenantId}
            sessionId={pending.sessionId}
            action={pending.action}
            running={false}
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
        <div className="flex flex-wrap gap-2">
          <NativeSelect
            aria-label="Filter by host"
            className="w-44"
            value={hostId}
            onChange={(event) => setSearch(chosen, event.target.value, triggerId)}
          >
            <option value="">Any host</option>
            {(hosts.data ?? []).map((host) => (
              <option key={host.hostId} value={host.hostId}>
                {host.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filter by trigger"
            className="w-44"
            value={triggerId}
            onChange={(event) => setSearch(chosen, hostId, event.target.value)}
          >
            <option value="">Any trigger or none</option>
            {(triggers.data ?? []).map((trigger) => (
              <option key={trigger.triggerId} value={trigger.triggerId}>
                {trigger.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-3">
        {hosts.isError && <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />}
        {personas.isError && <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />}
        {members.isError && <ProblemBlock error={members.error} onRetry={() => void members.refetch()} />}
        {triggers.isError && <ProblemBlock error={triggers.error} onRetry={() => void triggers.refetch()} />}
        {body()}
      </div>
    </>
  );
};
