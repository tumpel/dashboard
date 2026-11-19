import { TimeChart } from "../components/time-chart";
import { NativeSelect } from "../components/ui/native-select";
import { bucketGrid, formatValue, metricMissing, statOf, valuesOn } from "../metrics";
import type { MetricsSearch } from "../metrics-search";
import { SPLITS } from "../metrics-search";
import {
  bandSeries,
  type CardScope,
  ChartCard,
  FacetChips,
  MISSING_TEXT,
  StatToggle,
  startupStatOf,
  timeSeriesOf,
  useOpenPanel,
  useSeries,
} from "./metrics-cards";
import { MetricsPage } from "./metrics-page";
import { useSetSearch, useZoom } from "./metrics-view";

const DIMENSIONS = ["harness", "model", "startKind", "hostId", "harnessVersion"] as const;

const DIMENSION_LABELS: Record<string, string> = {
  harness: "Harness",
  model: "Model",
  startKind: "Start kind",
  hostId: "Host",
  harnessVersion: "Harness version",
};

const NO_MATCH = "No turns match these filters in this period.";

const StartupTimeCard = ({ scope, split }: { scope: CardScope; split: string }) => {
  const { view, catalog, filter, hostNames } = scope;
  const query = useSeries(scope, "turn.startup", split === "none" ? [] : [split], filter);
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const stat = startupStatOf(view);
  return (
    <ChartCard
      title="Startup time"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.startup") ? MISSING_TEXT["turn.startup"] : undefined}
      height={260}
      emptyText={NO_MATCH}
      filter={filter}
      actions={split === "none" ? undefined : <StatToggle view={view} />}
    >
      {([set]) => {
        if (set === undefined) return null;
        const series =
          split === "none"
            ? (() => {
                const band = bandSeries(set, grid, "var(--chart-1)", {});
                const points = set.series[0]?.points;
                if (band === undefined || points === undefined) return [];
                return [
                  ...band,
                  {
                    key: "p99",
                    label: "p99",
                    color: "var(--chart-1)",
                    mark: "line" as const,
                    dash: "6 3",
                    values: valuesOn(grid, points, (point) => point.p99),
                    group: {},
                  },
                ];
              })()
            : timeSeriesOf({
                set,
                grid,
                mark: "line",
                read: (point) => statOf(point, stat),
                catalog,
                metric: "turn.startup",
                hostNames,
              });
        return (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption={split === "none" ? "Seconds, p50 with p50 to p90 band and p99" : `Seconds, ${stat}`}
            format={(value) => formatValue(value, "s", stat)}
            series={series}
            onPoint={(item, at) => openPanel("turn.startup", at, item.group ?? {})}
            onZoom={zoom}
          />
        );
      }}
    </ChartCard>
  );
};

const PhasesCard = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, filter, hostNames } = scope;
  const query = useSeries(scope, "turn.phase", ["phase"], filter);
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  return (
    <ChartCard
      title="Startup phases"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.phase") ? MISSING_TEXT["turn.phase"] : undefined}
      height={260}
      emptyText={NO_MATCH}
      filter={filter}
    >
      {([set]) =>
        set === undefined ? null : (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption="Seconds, p50"
            format={(value) => formatValue(value, "s", "p50")}
            series={timeSeriesOf({
              set,
              grid,
              mark: "line",
              read: (point) => point.p50,
              catalog,
              metric: "turn.phase",
              hostNames,
            })}
            onPoint={(item, at) => openPanel("turn.phase", at, item.group ?? {})}
            onZoom={zoom}
          />
        )
      }
    </ChartCard>
  );
};

const ColdWarmCard = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, filter, hostNames } = scope;
  const query = useSeries(scope, "turn.startup", ["startKind"], filter);
  const openPanel = useOpenPanel(view);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  return (
    <ChartCard
      title="Cold and warm starts"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "turn.startup") ? MISSING_TEXT["turn.startup"] : undefined}
      height={240}
      emptyText={NO_MATCH}
      filter={filter}
    >
      {([set]) =>
        set === undefined ? null : (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption={`Turns started per ${view.bucket.toLowerCase()}`}
            format={(value) => formatValue(value, "{turn}", "Count")}
            series={timeSeriesOf({
              set,
              grid,
              mark: "column",
              read: (point) => point.count,
              catalog,
              metric: "turn.startup",
              hostNames,
            })}
            onPoint={(item, at) => openPanel("turn.startup", at, item.group ?? {})}
            onZoom={zoom}
          />
        )
      }
    </ChartCard>
  );
};

const SplitControl = ({ split }: { split: string }) => {
  const set = useSetSearch();
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="metrics-split">Split by</label>
      <NativeSelect
        id="metrics-split"
        className="w-auto"
        value={split}
        onChange={(event) => set({ split: SPLITS.filter((option) => option === event.target.value) })}
      >
        {SPLITS.map((option) => (
          <option key={option} value={option}>
            {option === "none" ? "Nothing" : (DIMENSION_LABELS[option] ?? option)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
};

export const MetricsStartupScreen = ({ tenantId, search }: { tenantId: string; search: MetricsSearch }) => {
  const split = search.split[0] ?? "harness";
  const harnesses = search.filter.filter((entry) => entry.startsWith("harness:"));
  const only = harnesses.length === 1 ? harnesses[0]?.slice("harness:".length) : undefined;
  return (
    <MetricsPage
      tenantId={tenantId}
      search={search}
      title="Startup"
      path="/startup"
      {...(only === undefined ? {} : { trail: only })}
      filter={search.filter}
      controls={(scope) => (
        <div className="grid gap-3">
          <FacetChips scope={scope} metric="turn.startup" dimensions={DIMENSIONS} labels={DIMENSION_LABELS} />
          <SplitControl split={split} />
        </div>
      )}
    >
      {(scope) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <StartupTimeCard scope={scope} split={split} />
          <PhasesCard scope={scope} />
          <ColdWarmCard scope={scope} />
        </div>
      )}
    </MetricsPage>
  );
};
