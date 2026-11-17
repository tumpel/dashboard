import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import type { MetricBucket, MetricEntry, MetricSeriesSet } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { TableSkeleton } from "../components/table-skeleton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { NativeSelect } from "../components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useClock } from "../context";
import { cn } from "../lib";
import {
  bucketFor,
  bucketLabel,
  bucketRows,
  defaultStat,
  fittingBuckets,
  formatValue,
  groupEntries,
  groupLabel,
  groupOf,
  type MetricRange,
  type MetricStat,
  narrowTo,
  RANGE_LABELS,
  RANGES,
  STATS,
  seriesQuery,
  statOf,
  toggleFilter,
  unitLabel,
  windowFor,
} from "../metrics";
import { useMetricCatalog, useMetricSeries, useMetricTurns } from "../queries";

const ROUTE = "/t/$tenantId/metrics";

type MetricsSearch = ReturnType<typeof useMetricsSearch>;

const useMetricsSearch = () => useSearch({ from: ROUTE });

const useSetSearch = () => {
  const navigate = useNavigate({ from: ROUTE });
  return (patch: Partial<MetricsSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, at: [], group: [], ...patch }) });
};

const Choice = ({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) => (
  <div className="grid gap-1 text-sm">
    <label htmlFor={id} className="font-medium">
      {label}
    </label>
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([option, text]) => (
        <option key={option} value={option}>
          {text}
        </option>
      ))}
    </NativeSelect>
  </div>
);

const Facets = ({ entry, filter }: { entry: MetricEntry; filter: string[] }) => {
  const set = useSetSearch();
  if (entry.facets.length === 0) return null;
  return (
    <div className="grid gap-3">
      {entry.facets.map((facet) => (
        <fieldset key={facet.dimension} className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">{facet.dimension}</legend>
          {facet.values.map(({ value }) => {
            const on = filter.includes(`${facet.dimension}:${value}`);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => set({ filter: toggleFilter(filter, facet.dimension, value) })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {value}
                {on && <XIcon className="size-3" aria-hidden />}
              </button>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
};

const ResultTable = ({
  set: result,
  entry,
  stat,
  filter,
  groupBy,
}: {
  set: MetricSeriesSet;
  entry: MetricEntry;
  stat: MetricStat;
  filter: string[];
  groupBy: string[];
}) => {
  const set = useSetSearch();
  const rows = bucketRows(result);
  const drillable = entry.kind === "Turn";
  const narrowed = result.series.map((series) => narrowTo(filter, series.group));
  return (
    <div className="grid gap-2">
      {drillable && <p className="text-sm text-muted-foreground">Pick a value to list the turns behind it.</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            {result.series.map((series, column) => {
              const label = groupLabel(series.group);
              const narrow = narrowed[column];
              const keys = Object.keys(series.group);
              return (
                <TableHead key={label} className="text-right">
                  {narrow === null || narrow === undefined || keys.length === 0 ? (
                    label
                  ) : (
                    <button
                      type="button"
                      className="hover:underline"
                      title={`Show ${label} alone`}
                      onClick={() =>
                        set({ filter: narrow, groupBy: groupBy.filter((dimension) => !keys.includes(dimension)) })
                      }
                    >
                      {label}
                    </button>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.bucketStart}>
              <TableCell className="font-mono text-[13px] whitespace-nowrap">
                {bucketLabel(row.bucketStart, result.bucket)}
              </TableCell>
              {row.cells.map((point, column) => {
                const series = result.series[column];
                const key = `${row.bucketStart}-${column}`;
                if (point === undefined || series === undefined) {
                  return (
                    <TableCell key={key} className="text-right text-muted-foreground">
                      -
                    </TableCell>
                  );
                }
                const text = formatValue(statOf(point, stat), result.unit, stat);
                if (!drillable || narrowed[column] === null) {
                  return (
                    <TableCell key={key} className="text-right tabular-nums">
                      {text}
                    </TableCell>
                  );
                }
                return (
                  <TableCell key={key} className="text-right tabular-nums">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => void set({ at: [row.bucketStart], group: groupEntries(series.group) })}
                    >
                      {text}
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const TurnsDialog = ({
  tenantId,
  entry,
  bucket,
  filter,
}: {
  tenantId: string;
  entry: MetricEntry;
  bucket: MetricBucket;
  filter: string[];
}) => {
  const { at, group } = useMetricsSearch();
  const set = useSetSearch();
  const bucketStart = at[0];
  const open = bucketStart !== undefined;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && set({})}>
      <DialogContent className="max-h-[85dvh] max-w-3xl grid-rows-[auto_1fr] overflow-hidden">
        {open && (
          <TurnsList
            tenantId={tenantId}
            entry={entry}
            bucket={bucket}
            bucketStart={bucketStart}
            group={groupOf(group)}
            filter={filter}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const TurnsList = ({
  tenantId,
  entry,
  bucket,
  bucketStart,
  group,
  filter,
}: {
  tenantId: string;
  entry: MetricEntry;
  bucket: MetricBucket;
  bucketStart: string;
  group: Record<string, string>;
  filter: string[];
}) => {
  const narrowed = narrowTo(filter, group) ?? filter;
  const turns = useMetricTurns(tenantId, entry.metric, bucketStart, bucket, narrowed);
  const body = () => {
    if (turns.isPending) return <TableSkeleton rows={4} />;
    if (turns.isError) return <ProblemBlock error={turns.error} onRetry={() => void turns.refetch()} />;
    const points = turns.data.pages.flatMap((page) => page.points);
    if (points.length === 0) {
      return <p className="text-sm text-muted-foreground">No turns in this bucket match the filters.</p>;
    }
    return (
      <div className="grid gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Turn</TableHead>
              <TableHead>Dimensions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={`${point.turnId}-${point.at}`}>
                <TableCell className="font-mono text-[13px] whitespace-nowrap">
                  {point.at.slice(0, 19).replace("T", " ")}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatValue(point.value, entry.unit, "Sum")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="grid">
                    <Link
                      to="/t/$tenantId/sessions/$sessionId/turns/$turnId"
                      params={{ tenantId, sessionId: point.sessionId, turnId: point.turnId }}
                      search={{ compact: [], tab: [] }}
                      className="font-mono text-[13px] text-primary hover:underline"
                    >
                      {point.turnId}
                    </Link>
                    <Link
                      to="/t/$tenantId/sessions/$sessionId"
                      params={{ tenantId, sessionId: point.sessionId }}
                      className="font-mono text-xs text-muted-foreground hover:underline"
                    >
                      {point.sessionId}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(point.dimensions)
                      .sort(([left], [right]) => left.localeCompare(right))
                      .map(([dimension, value]) => (
                        <Badge key={dimension}>
                          {dimension}: {value}
                        </Badge>
                      ))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {turns.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={turns.isFetchingNextPage}
            onClick={() => void turns.fetchNextPage()}
          >
            {turns.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        )}
      </div>
    );
  };
  return (
    <>
      <div className="grid gap-1 pr-6">
        <DialogTitle>Turns behind {entry.metric}</DialogTitle>
        <DialogDescription>
          {bucketLabel(bucketStart, bucket)}, {groupLabel(group)}
        </DialogDescription>
      </div>
      <div className="min-h-0 overflow-y-auto">{body()}</div>
    </>
  );
};

const Series = ({
  tenantId,
  entry,
  range,
  bucket,
  stat,
  filter,
  groupBy,
  offsetMinutes,
}: {
  tenantId: string;
  entry: MetricEntry;
  range: MetricRange;
  bucket: MetricBucket;
  stat: MetricStat;
  filter: string[];
  groupBy: string[];
  offsetMinutes: number;
}) => {
  const now = useClock();
  const set = useSetSearch();
  const query = seriesQuery(windowFor(range, now(), offsetMinutes), bucket, filter, groupBy);
  const series = useMetricSeries(tenantId, entry.metric, query);
  if (series.isPending) return <TableSkeleton rows={6} />;
  if (series.isError) return <ProblemBlock error={series.error} onRetry={() => void series.refetch()} />;
  if (series.data.series.every((item) => item.points.length === 0)) {
    return (
      <div className="grid justify-items-start gap-2 rounded-lg border bg-card p-6">
        <p className="font-medium">No points for {entry.metric} in this range</p>
        <p className="text-sm text-muted-foreground">Pick a longer range, or clear the filters.</p>
        {filter.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => set({ filter: [] })}>
            Clear filters
          </Button>
        )}
      </div>
    );
  }
  return <ResultTable set={series.data} entry={entry} stat={stat} filter={filter} groupBy={groupBy} />;
};

export const MetricsScreen = () => {
  const { tenantId } = useParams({ from: ROUTE });
  const search = useMetricsSearch();
  const set = useSetSearch();
  const now = useClock();
  const offsetMinutes = -new Date(now()).getTimezoneOffset();
  const range: MetricRange = search.range[0] ?? "24h";
  const bucket = bucketFor(range, search.bucket[0]);
  const catalog = useMetricCatalog(tenantId, windowFor(range, now(), offsetMinutes));
  const rangePicker = (
    <Choice
      id="metrics-range"
      label="Range"
      value={range}
      options={RANGES.map((option) => [option, RANGE_LABELS[option]] as const)}
      onChange={(value) => set({ range: RANGES.filter((option) => option === value), bucket: [] })}
    />
  );
  const body = () => {
    if (catalog.isPending) return <TableSkeleton rows={6} />;
    if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
    const metrics = catalog.data.metrics;
    const entry = metrics.find((item) => item.metric === search.metric[0]) ?? metrics[0];
    if (entry === undefined) {
      return (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-4">{rangePicker}</div>
          <EmptyState
            title="No metrics in this range"
            detail="Hosts report metrics while they run turns. Pick a longer range, or check that a host is online."
            action={
              <Button asChild variant="outline">
                <Link to="/t/$tenantId/hosts" params={{ tenantId }} search={{ state: [] }}>
                  Open hosts
                </Link>
              </Button>
            }
          />
        </div>
      );
    }
    const missing = search.metric[0] !== undefined && search.metric[0] !== entry.metric ? search.metric[0] : null;
    const dimensions = entry.facets.map((facet) => facet.dimension);
    const groupBy = search.groupBy.filter((dimension) => dimensions.includes(dimension));
    const stat = search.stat[0] ?? defaultStat(entry.kind, entry.unit);
    const groupChoice = (index: number) => {
      const others = groupBy.filter((_, position) => position !== index);
      return (
        <Choice
          id={`metrics-group-${index}`}
          label={index === 0 ? "Group by" : "Then by"}
          value={groupBy[index] ?? ""}
          options={[
            ["", "Nothing"],
            ...dimensions.filter((dimension) => !others.includes(dimension)).map((d) => [d, d] as const),
          ]}
          onChange={(value) => {
            const next = [...groupBy];
            if (value === "") next.splice(index, 1);
            else next[index] = value;
            set({ groupBy: next });
          }}
        />
      );
    };
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Choice
            id="metrics-metric"
            label="Metric"
            value={entry.metric}
            options={metrics.map((item) => [item.metric, item.metric] as const)}
            onChange={(value) => set({ metric: [value], filter: [], groupBy: [], stat: [] })}
          />
          {rangePicker}
          <Choice
            id="metrics-bucket"
            label="Bucket"
            value={bucket}
            options={fittingBuckets(range).map((option) => [option, option] as const)}
            onChange={(value) => set({ bucket: fittingBuckets(range).filter((option) => option === value) })}
          />
          <Choice
            id="metrics-stat"
            label="Show"
            value={stat}
            options={STATS.map((option) => [option, option] as const)}
            onChange={(value) => set({ stat: STATS.filter((option) => option === value) })}
          />
          {groupChoice(0)}
          {groupBy.length > 0 && groupChoice(1)}
        </div>
        <p className="text-sm text-muted-foreground">
          {entry.description} Unit: {unitLabel(entry.unit)}.
        </p>
        {missing !== null && (
          <p className="text-sm">
            {missing} has no points in this range, so this shows {entry.metric}.
          </p>
        )}
        <Facets entry={entry} filter={search.filter} />
        <Series
          tenantId={tenantId}
          entry={entry}
          range={range}
          bucket={bucket}
          stat={stat}
          filter={search.filter}
          groupBy={groupBy}
          offsetMinutes={offsetMinutes}
        />
        {entry.kind === "Turn" && (
          <TurnsDialog tenantId={tenantId} entry={entry} bucket={bucket} filter={search.filter} />
        )}
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Metrics" />
      {body()}
    </>
  );
};
