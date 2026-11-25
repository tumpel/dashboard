import { Link, useParams } from "@tanstack/react-router";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { RunState } from "../components/run-state";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime, personaName, repositoryLabel } from "../fleet";
import { useOwner, usePersonas, useRefusedStarts, useSessions, useTrigger } from "../queries";
import { eventLabel, filterSummary, runsOf, shortDelivery } from "../triggers";

const ROUTE = "/t/$tenantId/triggers/$triggerId";

export const TriggerScreen = () => {
  const { tenantId, triggerId } = useParams({ from: ROUTE });
  const owner = useOwner(tenantId);
  const trigger = useTrigger(tenantId, triggerId);
  const personas = usePersonas(tenantId);
  const sessions = useSessions(tenantId, triggerId);
  const refused = useRefusedStarts(tenantId, triggerId);
  const crumb = (
    <Link to="/t/$tenantId/triggers" params={{ tenantId }} className="hover:underline">
      Triggers /
    </Link>
  );
  if (trigger.isError) {
    return (
      <>
        <PageHeader title="Trigger" crumb={crumb} />
        <ProblemBlock error={trigger.error} onRetry={() => void trigger.refetch()} />
      </>
    );
  }
  if (trigger.isPending) {
    return (
      <>
        <PageHeader title="Trigger" crumb={crumb} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  const data = trigger.data;
  const runs = () => {
    if (sessions.isPending || refused.isPending) return <TableSkeleton rows={3} />;
    const rows = runsOf(triggerId, sessions.data ?? [], refused.data ?? []);
    if (rows.length === 0 && !sessions.isError && !refused.isError) {
      return (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No run yet. A run appears here when a matching {eventLabel(data.source)} event arrives.
        </p>
      );
    }
    return (
      <Table mobile>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((run) => (
            <TableRow key={`${run.kind}-${run.deliveryId}`}>
              <TableCell label="Started">{formatTime(run.at)}</TableCell>
              <TableCell label="Delivery" className="font-mono text-xs" title={run.deliveryId}>
                {shortDelivery(run.deliveryId)}
              </TableCell>
              <TableCell mobile="primary">
                {run.kind === "Session" ? (
                  <Link
                    to="/t/$tenantId/sessions/$sessionId"
                    params={{ tenantId, sessionId: run.session.sessionId }}
                    className="font-medium hover:underline"
                  >
                    {repositoryLabel(run.session.repository)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </TableCell>
              <TableCell mobile="summary">
                <RunState run={run} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };
  return (
    <>
      <PageHeader
        title={data.name}
        crumb={crumb}
        actions={
          <>
            {owner && (
              <Button variant="outline" asChild>
                <Link to="/t/$tenantId/triggers/$triggerId/edit" params={{ tenantId, triggerId }}>
                  Edit
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/t/$tenantId/triggers/$triggerId/edit" params={{ tenantId, triggerId }} hash="test">
                Test
              </Link>
            </Button>
          </>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        <span className="font-mono">{eventLabel(data.source)}</span> · {filterSummary(data.source)} ·{" "}
        {personaName(personas.data ?? [], data.personaId)} · {data.model}
      </p>
      {personas.isError && (
        <ProblemBlock className="mb-4" error={personas.error} onRetry={() => void personas.refetch()} />
      )}
      <h2 className="mb-2 font-semibold">Runs</h2>
      <div className="grid gap-3">
        {sessions.isError && <ProblemBlock error={sessions.error} onRetry={() => void sessions.refetch()} />}
        {refused.isError && <ProblemBlock error={refused.error} onRetry={() => void refused.refetch()} />}
        {runs()}
        <p className="text-xs text-muted-foreground">Newest first. Refused starts show for 7 days.</p>
      </div>
    </>
  );
};
