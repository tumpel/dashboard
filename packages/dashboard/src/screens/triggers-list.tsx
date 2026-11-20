import { Link, useParams } from "@tanstack/react-router";
import type { Session, TriggerStartRefused } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { RunState } from "../components/run-state";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime, personaName } from "../fleet";
import { useOwner, usePersonas, useRefusedStartsOf, useSessions, useTriggers } from "../queries";
import { filterSummary, runsOf } from "../triggers";

const LastRun = ({
  triggerId,
  sessions,
  refusals,
}: {
  triggerId: string;
  sessions: Session[];
  refusals: TriggerStartRefused[];
}) => {
  const last = runsOf(triggerId, sessions, refusals)[0];
  if (last === undefined) return <span className="text-muted-foreground">Never</span>;
  return (
    <div className="grid justify-items-start gap-0.5">
      <RunState run={last} />
      <span className="text-xs text-muted-foreground">{formatTime(last.at)}</span>
    </div>
  );
};

export const TriggersListScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/triggers" });
  const owner = useOwner(tenantId);
  const triggers = useTriggers(tenantId);
  const personas = usePersonas(tenantId);
  const sessions = useSessions(tenantId);
  const refused = useRefusedStartsOf(tenantId, triggers.data?.map((trigger) => trigger.triggerId) ?? []);
  const refusals = refused.flatMap((query) => query.data ?? []);
  const refusedFailure = refused.find((query) => query.isError);
  const create = owner ? (
    <Button asChild>
      <Link to="/t/$tenantId/triggers/new" params={{ tenantId }}>
        New trigger
      </Link>
    </Button>
  ) : null;
  const body = () => {
    if (triggers.isPending) return <TableSkeleton rows={3} />;
    if (triggers.isError) return <ProblemBlock error={triggers.error} onRetry={() => void triggers.refetch()} />;
    if (triggers.data.length === 0) {
      return (
        <EmptyState
          title="No triggers yet"
          detail={
            owner
              ? "A trigger starts a session when a GitHub event matches its conditions, such as a merged pull request or a label on an issue."
              : "A trigger starts a session when a GitHub event matches its conditions. An Owner creates them."
          }
          action={create}
        />
      );
    }
    return (
      <div className="grid gap-3">
        {personas.isError && <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />}
        {sessions.isError && <ProblemBlock error={sessions.error} onRetry={() => void sessions.refetch()} />}
        {refusedFailure !== undefined && (
          <ProblemBlock error={refusedFailure.error} onRetry={() => void refusedFailure.refetch()} />
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Filter</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Last run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {triggers.data.map((trigger) => (
              <TableRow key={trigger.triggerId}>
                <TableCell>
                  <Link
                    to="/t/$tenantId/triggers/$triggerId"
                    params={{ tenantId, triggerId: trigger.triggerId }}
                    className="font-medium hover:underline"
                  >
                    {trigger.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{trigger.source.event}</TableCell>
                <TableCell className="max-w-80 whitespace-normal">{filterSummary(trigger.source)}</TableCell>
                <TableCell>{personaName(personas.data ?? [], trigger.personaId)}</TableCell>
                <TableCell>
                  <LastRun triggerId={trigger.triggerId} sessions={sessions.data ?? []} refusals={refusals} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  return (
    <>
      <PageHeader
        title="Triggers"
        actions={triggers.isSuccess && triggers.data.length === 0 ? undefined : (create ?? undefined)}
      />
      {body()}
    </>
  );
};
