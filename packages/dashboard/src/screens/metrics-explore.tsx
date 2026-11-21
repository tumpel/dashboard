import type { MetricEntry, MetricSeriesSet } from "../api/port";
import { TimeChart } from "../components/time-chart";
import { NativeSelect } from "../components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  bucketGrid,
  bucketLabel,
  bucketRows,
  defaultStat,
  formatValue,
  groupEntries,
  groupLabel,
  type MetricStat,
  narrowTo,
  STATS,
  statOf,
  unitLabel,
} from "../metrics";
import type { MetricsSearch } from "../metrics-search";
import {
  bandSeries,
  type CardScope,
  ChartCard,
  FacetChips,
  timeSeriesOf,
  useOpenPanel,
  useSeries,
} from "./metrics-cards";
import { MetricsPage } from "./metrics-page";
import { useSetSearch, useZoom } from "./metrics-view";

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
      <Table mobile>
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
              <TableCell mobile="primary" className="font-mono text-[13px] whitespace-nowrap">
                {bucketLabel(row.bucketStart, result.bucket)}
              </TableCell>
              {row.cells.map((point, column) => {
                const series = result.series[column];
                const key = `${row.bucketStart}-${column}`;
                if (point === undefined || series === undefined) {
                  return (
                    <TableCell
                      key={key}
                      label={series === undefined ? undefined : groupLabel(series.group)}
                      className="text-right text-muted-foreground"
                    >
                      -
                    </TableCell>
                  );
                }
                const text = formatValue(statOf(point, stat), result.unit, stat);
                if (!drillable || narrowed[column] === null) {
                  return (
                    <TableCell key={key} label={groupLabel(series.group)} className="text-right tabular-nums">
                      {text}
                    </TableCell>
                  );
                }
                return (
                  <TableCell key={key} label={groupLabel(series.group)} className="text-right tabular-nums">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        void set({ metric: [entry.metric], at: [row.bucketStart], group: groupEntries(series.group) })
                      }
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

const entryOf = (scope: CardScope): { entry: MetricEntry; missing: string | null } => {
  const metrics = scope.catalog.metrics;
  const wanted = scope.view.search.metric[0];
  const entry = metrics.find((item) => item.metric === wanted) ?? metrics[0];
  if (entry === undefined) throw new Error("the catalog has no metric");
  return { entry, missing: wanted !== undefined && wanted !== entry.metric ? wanted : null };
};

const ExploreControls = ({ scope }: { scope: CardScope }) => {
  const set = useSetSearch();
  const { entry } = entryOf(scope);
  const dimensions = entry.facets.map((facet) => facet.dimension);
  const groupBy = scope.view.search.groupBy.filter((dimension) => dimensions.includes(dimension));
  const stat = scope.view.search.stat[0] ?? defaultStat(entry.kind, entry.unit);
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Choice
        id="metrics-metric"
        label="Metric"
        value={entry.metric}
        options={scope.catalog.metrics.map((item) => [item.metric, item.metric] as const)}
        onChange={(value) => set({ metric: [value], filter: [], groupBy: [], stat: [] })}
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
  );
};

const ExploreChart = ({
  scope,
  entry,
  set,
  stat,
  groupBy,
}: {
  scope: CardScope;
  entry: MetricEntry;
  set: MetricSeriesSet;
  stat: MetricStat;
  groupBy: string[];
}) => {
  const { view, catalog, hostNames } = scope;
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const column = entry.kind === "Turn" && (stat === "Count" || stat === "Sum");
  const single = groupBy.length === 0 && entry.kind === "Turn" && stat === "p50";
  const series =
    (single ? bandSeries(set, grid, "var(--chart-1)", {}) : undefined) ??
    timeSeriesOf({
      set,
      grid,
      mark: column ? "column" : "line",
      read: (point) => statOf(point, stat),
      catalog,
      metric: entry.metric,
      hostNames,
    });
  return (
    <TimeChart
      grid={grid}
      bucket={view.bucket}
      offsetMinutes={view.offsetMinutes}
      caption={`${unitLabel(entry.unit)}, ${stat}`}
      format={(value) => formatValue(value, entry.unit, stat)}
      series={series}
      tableToggle={false}
      onZoom={zoom}
      {...(entry.kind === "Turn" && { onPoint: (item, at) => openPanel(entry.metric, at, item.group ?? {}) })}
    />
  );
};

const ExploreBody = ({ scope }: { scope: CardScope }) => {
  const { entry, missing } = entryOf(scope);
  const { view, filter } = scope;
  const dimensions = entry.facets.map((facet) => facet.dimension);
  const groupBy = view.search.groupBy.filter((dimension) => dimensions.includes(dimension));
  const stat = view.search.stat[0] ?? defaultStat(entry.kind, entry.unit);
  const query = useSeries(scope, entry.metric, groupBy, filter);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {entry.description} Unit: {unitLabel(entry.unit)}.
      </p>
      {missing !== null && (
        <p className="text-sm">
          {missing} has no points in this range, so this shows {entry.metric}.
        </p>
      )}
      <FacetChips scope={scope} metric={entry.metric} dimensions={dimensions} />
      <ChartCard
        title={entry.metric}
        queries={[query]}
        missing={undefined}
        height={260}
        emptyText="No points match these filters in this period."
        filter={filter}
      >
        {([set]) =>
          set === undefined ? null : (
            <div className="grid gap-4">
              <ExploreChart scope={scope} entry={entry} set={set} stat={stat} groupBy={groupBy} />
              <ResultTable set={set} entry={entry} stat={stat} filter={filter} groupBy={groupBy} />
            </div>
          )
        }
      </ChartCard>
    </div>
  );
};

export const MetricsExploreScreen = ({ tenantId, search }: { tenantId: string; search: MetricsSearch }) => (
  <MetricsPage
    tenantId={tenantId}
    search={search}
    title="Explore"
    path="/explore"
    filter={search.filter}
    controls={(scope) => <ExploreControls scope={scope} />}
  >
    {(scope) => <ExploreBody scope={scope} />}
  </MetricsPage>
);
