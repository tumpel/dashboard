import type { UseQueryResult } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MetricCatalog, MetricSeriesSet } from "../api/port";
import { ProblemBlock } from "../components/problem-block";
import { TimeChart, type TimeSeries } from "../components/time-chart";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../lib";
import {
  bucketGrid,
  entityColor,
  filterEntry,
  formatValue,
  groupEntries,
  groupLabel,
  type MetricStat,
  metricMissing,
  narrowTo,
  seriesQuery,
  statOf,
  toggleFilter,
  valuesOn,
  WATERFALL_DASHES,
  zoned,
} from "../metrics";
import { useMetricSeries, useMetricSeriesList } from "../queries";
import { rememberClickedMark } from "./metrics-bucket-panel";
import { linkSearch, type MetricsView, useSetSearch, useZoom } from "./metrics-view";

export const MISSING_TEXT: Record<string, string> = {
  "turn.startup": "No turns started in this period.",
  "turn.phase": "No turn has reported startup phases in this period.",
  "turn.end": "No turns ended in this period.",
  "turn.cost": "No spend reported in this period.",
  "host.cpu.busy": "No host has reported load in this period.",
  "host.load.1m": "No host has reported load in this period.",
  "host.memory.available": "No host has reported memory in this period.",
  "host.boxes.running": "No host has reported boxes in this period.",
};

export interface CardScope {
  view: MetricsView;
  catalog: MetricCatalog;
  filter: string[];
  hostNames: (hostId: string) => string;
}

export const useSeries = (
  scope: Pick<CardScope, "view" | "catalog">,
  metric: string,
  groupBy: readonly string[],
  filter: readonly string[],
): UseQueryResult<MetricSeriesSet> =>
  useMetricSeries(
    scope.view.tenantId,
    metricMissing(scope.catalog.metrics, metric) ? null : metric,
    seriesQuery(scope.view.window, scope.view.bucket, filter, groupBy),
  );

export const useSeriesList = (
  scope: Pick<CardScope, "view" | "catalog">,
  metrics: readonly string[],
  filter: readonly string[],
): UseQueryResult<MetricSeriesSet>[] =>
  useMetricSeriesList(
    scope.view.tenantId,
    metrics.map((metric) => ({
      metric: metricMissing(scope.catalog.metrics, metric) ? null : metric,
      query: seriesQuery(scope.view.window, scope.view.bucket, filter, []),
    })),
  );

export const facetValues = (catalog: MetricCatalog, metric: string, dimension: string): string[] =>
  catalog.metrics
    .find((entry) => entry.metric === metric)
    ?.facets.find((facet) => facet.dimension === dimension)
    ?.values.map((item) => item.value) ?? [];

export const isEmptySet = (set: MetricSeriesSet): boolean => set.series.every((series) => series.points.length === 0);

export const ChartCard = ({
  title,
  queries,
  missing,
  height,
  emptyText,
  filter = [],
  actions,
  className,
  children,
}: {
  title: string;
  queries: UseQueryResult<MetricSeriesSet>[];
  missing: string | undefined;
  height: number;
  emptyText: string;
  filter?: string[];
  actions?: ReactNode;
  className?: string;
  children: (sets: MetricSeriesSet[]) => ReactNode;
}) => {
  const set = useSetSearch();
  const body = () => {
    if (missing !== undefined) return <p className="text-sm text-muted-foreground">{missing}</p>;
    const failed = queries.find((query) => query.isError);
    if (failed !== undefined) {
      return <ProblemBlock error={failed.error} onRetry={() => void failed.refetch()} />;
    }
    const sets = queries.flatMap((query) => (query.data === undefined ? [] : [query.data]));
    if (sets.length < queries.length) return <Skeleton aria-busy style={{ height }} className="w-full" />;
    if (sets.every(isEmptySet)) {
      return (
        <div className="grid justify-items-start gap-2">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          {filter.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => set({ filter: [] })}>
              Clear filters
            </Button>
          )}
        </div>
      );
    }
    return children(sets);
  };
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-[15px]">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent
        className={cn("transition-opacity", queries.some((query) => query.isPlaceholderData) && "opacity-60")}
      >
        {body()}
      </CardContent>
    </Card>
  );
};

export interface SeriesOptions {
  set: MetricSeriesSet;
  grid: number[];
  mark: TimeSeries["mark"];
  read: (point: MetricSeriesSet["series"][number]["points"][number]) => number;
  catalog: MetricCatalog;
  metric: string;
  hostNames: (hostId: string) => string;
  order?: (left: string, right: string) => number;
}

const labelOfValue = (dimension: string, value: string, hostNames: (hostId: string) => string): string =>
  dimension === "hostId" ? hostNames(value) : value;

export const timeSeriesOf = ({
  set,
  grid,
  mark,
  read,
  catalog,
  metric,
  hostNames,
  order,
}: SeriesOptions): TimeSeries[] =>
  set.series
    .map((series) => {
      const dimensions = Object.keys(series.group).sort();
      const first = dimensions[0];
      const second = dimensions[1];
      const value = first === undefined ? "" : (series.group[first] ?? "");
      const secondIndex =
        second === undefined
          ? 0
          : facetValues(catalog, metric, second)
              .sort()
              .indexOf(series.group[second] ?? "");
      const label =
        dimensions.length === 0
          ? "All"
          : dimensions
              .map((dimension) => labelOfValue(dimension, series.group[dimension] ?? "", hostNames))
              .join(" · ");
      return {
        key: groupLabel(series.group),
        label,
        color: first === undefined ? "var(--chart-1)" : entityColor(first, value, facetValues(catalog, metric, first)),
        mark,
        values: valuesOn(grid, series.points, read),
        group: series.group,
        ...(secondIndex > 0 && { dash: WATERFALL_DASHES[secondIndex % WATERFALL_DASHES.length] }),
        ...(first === "outcome" &&
          value !== "Completed" &&
          value !== "Withdrawn" &&
          value !== "Other" && { warning: true }),
      };
    })
    .sort((left, right) => (order ?? ((a: string, b: string) => a.localeCompare(b)))(left.label, right.label));

export const bandSeries = (
  set: MetricSeriesSet,
  grid: number[],
  color: string,
  group: Record<string, string>,
): TimeSeries[] | undefined => {
  const points = set.series[0]?.points;
  if (points === undefined) return undefined;
  return [
    { key: "p50", label: "p50", color, mark: "line", values: valuesOn(grid, points, (point) => point.p50), group },
    {
      key: "p90",
      label: "p50 to p90",
      color,
      mark: "band",
      values: valuesOn(grid, points, (point) => point.p50),
      upper: valuesOn(grid, points, (point) => point.p90),
      group,
    },
  ];
};

export const useOpenPanel = (
  view: MetricsView,
): ((metric: string, at: number, group: Record<string, string>) => void) => {
  const set = useSetSearch();
  return (metric, at, group) => {
    if (narrowTo([], group) === null) return;
    rememberClickedMark();
    set({ metric: [metric], at: [zoned(at, view.offsetMinutes)], group: groupEntries(group) });
  };
};

export const OutcomeCard = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, filter, hostNames } = scope;
  const query = useSeries(scope, "turn.end", ["outcome"], filter);
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const rank = (outcome: string): number => (outcome === "Completed" ? 0 : outcome === "Withdrawn" ? 1 : 2);
  return (
    <ChartCard
      title="Turns ended by outcome"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.end") ? MISSING_TEXT["turn.end"] : undefined}
      height={240}
      emptyText="No turns match these filters in this period."
      filter={filter}
    >
      {([set]) =>
        set === undefined ? null : (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption={`Turns per ${view.bucket.toLowerCase()}`}
            format={(value) => formatValue(value, "{turn}", "Count")}
            series={timeSeriesOf({
              set,
              grid,
              mark: "column",
              read: (point) => point.count,
              catalog,
              metric: "turn.end",
              hostNames,
              order: (left, right) => rank(left) - rank(right) || left.localeCompare(right),
            })}
            onPoint={(series, at) => openPanel("turn.end", at, series.group ?? {})}
            onZoom={zoom}
          />
        )
      }
    </ChartCard>
  );
};

export const STARTUP_STATS = ["p50", "p90", "p99"] as const satisfies readonly MetricStat[];

export const StatToggle = ({ view }: { view: MetricsView }) => {
  const set = useSetSearch();
  const current = view.search.stat[0] ?? "p50";
  return (
    <fieldset aria-label="Percentile" className="flex overflow-hidden rounded-md border">
      {STARTUP_STATS.map((stat) => (
        <button
          key={stat}
          type="button"
          aria-pressed={current === stat}
          className={cn(
            "px-2.5 py-1 text-xs",
            current === stat ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
          onClick={() => set({ stat: [stat], back: view.search.back })}
        >
          {stat}
        </button>
      ))}
    </fieldset>
  );
};

export const startupStatOf = (view: MetricsView): MetricStat => {
  const stat = view.search.stat[0];
  return stat === "p90" || stat === "p99" ? stat : "p50";
};

export const HarnessStartupCard = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, filter, hostNames } = scope;
  const navigate = useNavigate();
  const query = useSeries(scope, "turn.startup", ["harness"], filter);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const stat = startupStatOf(view);
  const openStartup = (series: TimeSeries) =>
    void navigate({
      to: "/t/$tenantId/metrics/startup",
      params: { tenantId: view.tenantId },
      search: linkSearch(view.search, {
        filter: [...filter, `harness:${series.group?.harness ?? ""}`],
        stat: view.search.stat,
      }),
    });
  return (
    <ChartCard
      title="Startup by harness"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.startup") ? MISSING_TEXT["turn.startup"] : undefined}
      height={240}
      emptyText="No turns match these filters in this period."
      filter={filter}
      actions={<StatToggle view={view} />}
    >
      {([set]) =>
        set === undefined ? null : (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption={`Seconds, ${stat}`}
            format={(value) => formatValue(value, "s", stat)}
            series={timeSeriesOf({
              set,
              grid,
              mark: "line",
              read: (point) => statOf(point, stat),
              catalog,
              metric: "turn.startup",
              hostNames,
            })}
            onSeries={openStartup}
            onPoint={openStartup}
            onZoom={zoom}
          />
        )
      }
    </ChartCard>
  );
};

export const PhaseCard = ({
  scope,
  phase,
  title,
}: {
  scope: CardScope;
  phase: "ImageFetch" | "FirstOutput";
  title: string;
}) => {
  const { view, catalog, filter } = scope;
  const query = useSeries(scope, "turn.phase", [], [...filter, `phase:${phase}`]);
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  return (
    <ChartCard
      title={title}
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.phase") ? MISSING_TEXT["turn.phase"] : undefined}
      height={220}
      emptyText="No turns match these filters in this period."
      filter={filter}
    >
      {([set]) => {
        if (set === undefined) return null;
        const series = bandSeries(set, grid, entityColor("phase", phase, []), { phase });
        if (series === undefined) return null;
        return (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption="Seconds, p50 with p50 to p90 band"
            format={(value) => formatValue(value, "s", "p50")}
            series={series}
            onPoint={(_, at) => openPanel("turn.phase", at, { phase })}
            onZoom={zoom}
          />
        );
      }}
    </ChartCard>
  );
};

export const FacetChips = ({
  scope,
  metric,
  dimensions,
  labels,
}: {
  scope: CardScope;
  metric: string;
  dimensions: readonly string[];
  labels?: Record<string, string>;
}) => {
  const set = useSetSearch();
  const { filter, catalog, hostNames } = scope;
  return (
    <div className="grid gap-3">
      {dimensions.map((dimension) => {
        const values = facetValues(catalog, metric, dimension);
        if (values.length === 0) return null;
        return (
          <fieldset key={dimension} className="flex flex-wrap items-center gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">
              {labels?.[dimension] ?? dimension}
            </legend>
            {values.map((value) => {
              const on = filter.includes(filterEntry(dimension, value));
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ filter: toggleFilter(filter, dimension, value), back: scope.view.search.back })}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  {dimension === "hostId" ? hostNames(value) : value}
                  {on && <XIcon className="size-3" aria-hidden />}
                </button>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
};
