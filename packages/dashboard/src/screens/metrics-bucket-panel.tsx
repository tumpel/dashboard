import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProblemBlock } from "../components/problem-block";
import { PhaseBars } from "../components/startup-waterfall";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../components/ui/sheet";
import {
  bucketSpanLabel,
  bucketWindow,
  formatValue,
  groupLabel,
  groupOf,
  narrowTo,
  phaseWindow,
  seriesQuery,
  waterfalls,
} from "../metrics";
import { useMetricSeries, useMetricTurns } from "../queries";
import type { CardScope } from "./metrics-cards";
import { useSetSearch } from "./metrics-view";

let clickedMark: Element | null = null;

export const rememberClickedMark = (): void => {
  clickedMark = document.activeElement;
};

const restoreClickedMark = (): void => {
  if (clickedMark instanceof HTMLElement || clickedMark instanceof SVGElement) clickedMark.focus();
};

const DIMENSION_COLUMNS = ["harness", "hostId", "startKind", "model", "outcome"] as const;

export const BucketPanel = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, filter } = scope;
  const set = useSetSearch();
  const at = view.search.at[0];
  const metric = view.search.metric[0];
  const entry = catalog.metrics.find((item) => item.metric === metric);
  return (
    <Sheet open={at !== undefined && entry !== undefined} onOpenChange={(open) => !open && set({})}>
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreClickedMark();
        }}
      >
        {at !== undefined && entry !== undefined && (
          <PanelBody scope={scope} metric={entry.metric} unit={entry.unit} bucketStart={at} filter={filter} />
        )}
      </SheetContent>
    </Sheet>
  );
};

const PanelBody = ({
  scope,
  metric,
  unit,
  bucketStart,
  filter,
}: {
  scope: CardScope;
  metric: string;
  unit: string;
  bucketStart: string;
  filter: string[];
}) => {
  const { view, hostNames } = scope;
  const { tenantId, bucket } = view;
  const group = groupOf(view.search.group);
  const narrowed = narrowTo(filter, group) ?? filter;
  const window = bucketWindow(bucketStart, bucket);
  const point = useMetricSeries(
    tenantId,
    metric,
    seriesQuery(view.window, bucket, narrowed, []),
  ).data?.series[0]?.points.find((candidate) => Date.parse(candidate.bucketStart) === Date.parse(bucketStart));
  const turns = useMetricTurns(tenantId, metric, window, narrowed, true);
  const startup = metric === "turn.startup";
  const phases = useMetricTurns(
    tenantId,
    "turn.phase",
    phaseWindow(bucketStart, bucket, point?.max ?? 0),
    narrowed,
    startup && point !== undefined,
  );
  const points = turns.data?.pages.flatMap((page) => page.points) ?? [];
  const phasePoints = phases.data?.pages.flatMap((page) => page.points) ?? [];
  const lastRowAt = points.at(-1)?.at;
  const lastPhaseAt = phasePoints.at(-1)?.at;
  useEffect(() => {
    if (!phases.hasNextPage || phases.isFetchingNextPage || lastRowAt === undefined) return;
    if (lastPhaseAt === undefined || Date.parse(lastPhaseAt) < Date.parse(lastRowAt)) void phases.fetchNextPage();
  }, [phases, lastRowAt, lastPhaseAt]);
  const bars = new Map(waterfalls(phasePoints, []).map((turn) => [turn.turnId, turn]));
  const names = Object.fromEntries(
    Object.entries(group).map(([dimension, value]) => [dimension, dimension === "hostId" ? hostNames(value) : value]),
  );
  const body = () => {
    if (turns.isPending) return <TableSkeleton rows={5} />;
    if (turns.isError) return <ProblemBlock error={turns.error} onRetry={() => void turns.refetch()} />;
    if (points.length === 0) {
      return <p className="text-sm text-muted-foreground">No turns in this bucket match the filters.</p>;
    }
    return (
      <div className="grid gap-3">
        <ul className="grid divide-y rounded-md border">
          {points.map((item) => {
            const waterfall = bars.get(item.turnId);
            return (
              <li key={`${item.turnId}-${item.at}`} className="grid gap-1 p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {item.at.slice(0, 19).replace("T", " ")}
                  </span>
                  <span className="font-semibold tabular-nums">{formatValue(item.value, unit, "Mean")}</span>
                </div>
                {startup && waterfall !== undefined && (
                  <PhaseBars bars={waterfall.bars} totalSeconds={waterfall.totalSeconds} thin />
                )}
                <div className="text-xs text-muted-foreground">
                  {DIMENSION_COLUMNS.flatMap((dimension) => {
                    const value = item.dimensions[dimension];
                    return value === undefined ? [] : [dimension === "hostId" ? hostNames(value) : value];
                  }).join(" · ")}
                </div>
                <Link
                  to="/t/$tenantId/sessions/$sessionId/turns/$turnId"
                  params={{ tenantId, sessionId: item.sessionId, turnId: item.turnId }}
                  search={{ compact: [], tab: [] }}
                  className="font-mono text-[13px] underline underline-offset-2 hover:no-underline"
                >
                  {item.turnId}
                </Link>
                <Link
                  to="/t/$tenantId/sessions/$sessionId"
                  params={{ tenantId, sessionId: item.sessionId }}
                  className="font-mono text-xs text-muted-foreground hover:underline"
                >
                  {item.sessionId}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {formatValue(points.length, "{turn}", "Count")}
            {point === undefined ? " turns" : ` of ${formatValue(point.count, "{turn}", "Count")} turns`}
          </span>
          {turns.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              disabled={turns.isFetchingNextPage}
              onClick={() => void turns.fetchNextPage()}
            >
              {turns.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="grid gap-1 pr-8">
        <SheetTitle className="text-[17px] font-semibold">{metric}</SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          {bucketSpanLabel(Date.parse(bucketStart), bucket, view.offsetMinutes)}
          {Object.keys(group).length > 0 && `, ${groupLabel(names)}`}
        </SheetDescription>
        {point !== undefined && (
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            {[
              ["Count", formatValue(point.count, "{turn}", "Count")],
              ["p50", formatValue(point.p50, unit, "p50")],
              ["p90", formatValue(point.p90, unit, "p90")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border bg-muted p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="min-h-0 overflow-y-auto">{body()}</div>
    </>
  );
};
