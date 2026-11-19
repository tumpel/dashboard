import { Link } from "@tanstack/react-router";
import type { Session, Turn } from "../api/port";
import { ProblemBlock } from "../components/problem-block";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useClock } from "../context";
import { COST_METRIC, type CostTally, costByTurn, formatValue, sessionCost, sinceWindow } from "../metrics";
import { useMetricCatalog, useSessionPoints } from "../queries";

const dollars = (value: number): string => formatValue(value, "uUSD", "Sum");

const CostText = ({ tally }: { tally: CostTally | undefined }) => {
  if (tally === undefined || !tally.reported) return <span className="text-muted-foreground">Cost not reported</span>;
  return (
    <span className="grid justify-items-end">
      {(tally.billed > 0 || tally.notBilled === 0) && (
        <span className="font-semibold tabular-nums">{dollars(tally.billed)}</span>
      )}
      {tally.notBilled > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">{dollars(tally.notBilled)} not billed</span>
      )}
    </span>
  );
};

const Total = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-0.5 rounded-lg border bg-card p-3">
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
    <span className="text-xl font-semibold tabular-nums">{value}</span>
  </div>
);

export const SessionCostTab = ({ tenantId, session, turns }: { tenantId: string; session: Session; turns: Turn[] }) => {
  const now = useClock();
  const window = sinceWindow(session.createdAt, now(), -new Date(now()).getTimezoneOffset());
  const catalog = useMetricCatalog(tenantId, window);
  const reported = catalog.data?.metrics.some((entry) => entry.metric === COST_METRIC) ?? false;
  const points = useSessionPoints(tenantId, session.sessionId, COST_METRIC, window, reported);
  if (catalog.isPending) return <Skeleton className="h-40 w-full" />;
  if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
  if (!reported) {
    return (
      <p className="text-sm text-muted-foreground">
        No cost reported for this session. Hosts report cost when a turn ends, for harnesses that report it.
      </p>
    );
  }
  if (points.isPending) return <Skeleton className="h-40 w-full" />;
  if (points.isError) return <ProblemBlock error={points.error} onRetry={() => void points.refetch()} />;
  const byTurn = costByTurn(points.data);
  const total = sessionCost(byTurn.values());
  const unreported = turns.filter((turn) => byTurn.get(turn.turnId)?.reported !== true).length;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Total label="Billed" value={dollars(total.billed)} />
        <Total label="Not billed" value={dollars(total.notBilled)} />
        <Total label="Cost not reported" value={`${unreported} of ${turns.length} turns`} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Turn</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {turns.map((turn, index) => (
            <TableRow key={turn.turnId}>
              <TableCell>
                <Link
                  to="/t/$tenantId/sessions/$sessionId/turns/$turnId"
                  params={{ tenantId, sessionId: session.sessionId, turnId: turn.turnId }}
                  search={{ compact: [], tab: [] }}
                  className="hover:underline"
                >
                  Turn {index + 1}
                </Link>
              </TableCell>
              <TableCell>{turn.state}</TableCell>
              <TableCell className="text-right">
                <CostText tally={byTurn.get(turn.turnId)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
