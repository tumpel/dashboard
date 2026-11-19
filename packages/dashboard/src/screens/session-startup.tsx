import type { Session, Turn } from "../api/port";
import { ProblemBlock } from "../components/problem-block";
import { StartupWaterfall } from "../components/startup-waterfall";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useClock } from "../context";
import { sinceWindow, waterfalls } from "../metrics";
import { useMetricCatalog, useSessionPoints } from "../queries";

const PHASE_METRIC = "turn.phase";
const STARTUP_METRIC = "turn.startup";

export const SessionStartupCard = ({
  tenantId,
  session,
  turns,
  turnId,
}: {
  tenantId: string;
  session: Session;
  turns: Turn[];
  turnId?: string;
}) => {
  const now = useClock();
  const window = sinceWindow(session.createdAt, now(), -new Date(now()).getTimezoneOffset());
  const catalog = useMetricCatalog(tenantId, window);
  const reported = catalog.data?.metrics.some((entry) => entry.metric === PHASE_METRIC) ?? false;
  const phases = useSessionPoints(tenantId, session.sessionId, PHASE_METRIC, window, reported);
  const startups = useSessionPoints(tenantId, session.sessionId, STARTUP_METRIC, window, reported);
  const body = () => {
    if (catalog.isPending) return <Skeleton className="h-24 w-full" />;
    if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
    if (!reported) {
      return <p className="text-sm text-muted-foreground">No startup timings reported for this session.</p>;
    }
    const failed = phases.isError ? phases : startups.isError ? startups : undefined;
    if (failed !== undefined) return <ProblemBlock error={failed.error} onRetry={() => void failed.refetch()} />;
    if (phases.data === undefined || startups.data === undefined) return <Skeleton className="h-24 w-full" />;
    const shown = waterfalls(phases.data, startups.data).filter(
      (turn) => turnId === undefined || turn.turnId === turnId,
    );
    if (shown.length === 0) {
      return <p className="text-sm text-muted-foreground">No startup timings reported for this turn.</p>;
    }
    const labelOf = (id: string): string => `Turn ${turns.findIndex((turn) => turn.turnId === id) + 1}`;
    return <StartupWaterfall turns={shown} labelOf={labelOf} />;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Startup</CardTitle>
      </CardHeader>
      <CardContent>{body()}</CardContent>
    </Card>
  );
};
