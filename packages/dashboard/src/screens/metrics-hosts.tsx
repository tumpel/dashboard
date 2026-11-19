import { Link } from "@tanstack/react-router";
import type { MetricSeriesSet as MetricSeriesSetLike } from "../api/port";
import { TimeChart, type TimeSeries } from "../components/time-chart";
import { Button } from "../components/ui/button";
import {
  bucketGrid,
  formatValue,
  type GridValues,
  memoryUsedMiB,
  metricMissing,
  percentLabel,
  placeOnGrid,
  valuesOn,
} from "../metrics";
import type { MetricsSearch } from "../metrics-search";
import { useHost, useHostUsage } from "../queries";
import {
  type CardScope,
  ChartCard,
  HarnessStartupCard,
  MISSING_TEXT,
  OutcomeCard,
  timeSeriesOf,
  useSeries,
  useSeriesList,
} from "./metrics-cards";
import { DroppedBanner, HostsTable } from "./metrics-hosts-table";
import { MetricsPage } from "./metrics-page";
import { useZoom } from "./metrics-view";

const NO_MATCH = "No host has reported in this period.";

const HostCpuCard = ({ scope }: { scope: CardScope }) => {
  const { view, catalog, hostNames } = scope;
  const query = useSeries(scope, "host.cpu.busy", ["hostId"], []);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  return (
    <ChartCard
      title="CPU busy by host"
      queries={[query]}
      missing={metricMissing(catalog.metrics, "host.cpu.busy") ? MISSING_TEXT["host.cpu.busy"] : undefined}
      height={260}
      emptyText={NO_MATCH}
    >
      {([set]) =>
        set === undefined ? null : (
          <TimeChart
            grid={grid}
            bucket={view.bucket}
            offsetMinutes={view.offsetMinutes}
            caption="Share of CPU time busy, mean"
            format={percentLabel}
            domain={[0, 1]}
            series={timeSeriesOf({
              set,
              grid,
              mark: "line",
              read: (point) => point.sum / point.count,
              catalog,
              metric: "host.cpu.busy",
              hostNames,
            })}
            onZoom={zoom}
          />
        )
      }
    </ChartCard>
  );
};

export const MetricsHostsScreen = ({ tenantId, search }: { tenantId: string; search: MetricsSearch }) => (
  <MetricsPage tenantId={tenantId} search={search} title="Hosts" path="/hosts" filter={[]}>
    {(scope) => (
      <div className="grid gap-4">
        <DroppedBanner scope={scope} />
        <HostsTable scope={scope} title="All hosts" />
        <HostCpuCard scope={scope} />
      </div>
    )}
  </MetricsPage>
);

const mean = (point: { sum: number; count: number }): number => point.sum / point.count;

const sample = (
  key: string,
  label: string,
  color: string,
  mark: TimeSeries["mark"],
  values: GridValues,
  dash?: string,
): TimeSeries => ({ key, label, color, mark, values, ...(dash === undefined ? {} : { dash }) });

const HostSampleCard = ({
  scope,
  title,
  metrics,
  caption,
  format,
  domain,
  build,
  reference,
}: {
  scope: CardScope;
  title: string;
  metrics: readonly string[];
  caption: string;
  format: (value: number) => string;
  domain?: [number, number | "auto"];
  build: (sets: MetricSeriesSetLike[], grid: number[]) => TimeSeries[];
  reference?: { value: number; label: string } | undefined;
}) => {
  const { view, catalog } = scope;
  const filter = scope.filter;
  const queries = useSeriesList(scope, metrics, filter);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const missing = metrics.find((metric) => metricMissing(catalog.metrics, metric));
  return (
    <ChartCard
      title={title}
      queries={queries}
      missing={missing === undefined ? undefined : MISSING_TEXT[missing]}
      height={240}
      emptyText={NO_MATCH}
    >
      {(sets) => (
        <TimeChart
          grid={grid}
          bucket={view.bucket}
          offsetMinutes={view.offsetMinutes}
          caption={caption}
          format={format}
          series={build(sets, grid)}
          onZoom={zoom}
          {...(domain === undefined ? {} : { domain })}
          {...(reference === undefined ? {} : { reference })}
        />
      )}
    </ChartCard>
  );
};

const pointsOf = (set: MetricSeriesSetLike | undefined) => set?.series[0]?.points ?? [];

const HostDroppedCard = ({ scope }: { scope: CardScope }) => {
  const { view } = scope;
  const query = useSeries(scope, "telemetry.dropped", [], scope.filter);
  const zoom = useZoom(view);
  const grid = bucketGrid(view.window, view.bucket);
  const dropped = query.data?.series[0]?.points.some((point) => point.sum > 0) ?? false;
  if (!dropped || query.data === undefined) return null;
  return (
    <ChartCard title="Dropped measurements" queries={[query]} missing={undefined} height={200} emptyText={NO_MATCH}>
      {([set]) => (
        <TimeChart
          grid={grid}
          bucket={view.bucket}
          offsetMinutes={view.offsetMinutes}
          caption={`Points dropped per ${view.bucket.toLowerCase()}`}
          format={(value) => formatValue(value, "{point}", "Count")}
          series={[
            sample(
              "dropped",
              "Dropped",
              "var(--chart-4)",
              "column",
              valuesOn(grid, pointsOf(set), (point) => point.sum),
            ),
          ]}
          onZoom={zoom}
        />
      )}
    </ChartCard>
  );
};

export const MetricsHostScreen = ({
  tenantId,
  hostId,
  search,
}: {
  tenantId: string;
  hostId: string;
  search: MetricsSearch;
}) => {
  const host = useHost(tenantId, hostId);
  const usage = useHostUsage(tenantId);
  const capacity = usage.data?.find((row) => row.hostId === hostId)?.boxCapacity;
  const filter = [`hostId:${hostId}`];
  const name = host.data?.name ?? hostId;
  return (
    <MetricsPage tenantId={tenantId} search={search} title={name} path="/hosts" trail={name} filter={filter}>
      {(scope) => {
        const color = (index: number) => `var(--chart-${index})`;
        return (
          <div className="grid gap-4">
            <div>
              <Button asChild variant="outline" size="sm">
                <Link to="/t/$tenantId/hosts/$hostId" params={{ tenantId, hostId }}>
                  Open host
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <HostSampleCard
                scope={scope}
                title="CPU busy"
                metrics={["host.cpu.busy"]}
                caption="Share of CPU time busy, mean with max"
                format={percentLabel}
                domain={[0, 1]}
                build={([set], grid) => [
                  sample(
                    "max",
                    "Max",
                    color(2),
                    "line",
                    valuesOn(grid, pointsOf(set), (point) => point.max),
                  ),
                  sample("mean", "Mean", color(1), "area", valuesOn(grid, pointsOf(set), mean)),
                ]}
              />
              <HostSampleCard
                scope={scope}
                title="Load"
                metrics={["host.load.1m", "host.load.5m", "host.load.15m"]}
                caption="Load average, mean"
                format={(value) => formatValue(value, "1", "Mean")}
                reference={host.data === undefined ? undefined : { value: host.data.cpuCount, label: "CPU count" }}
                build={(sets, grid) =>
                  ["1m", "5m", "15m"].map((label, index) =>
                    sample(label, label, color(index + 1), "line", valuesOn(grid, pointsOf(sets[index]), mean)),
                  )
                }
              />
              <HostSampleCard
                scope={scope}
                title="Memory"
                metrics={["host.memory.available", "host.memory.total"]}
                caption="MiB, mean"
                format={(value) => formatValue(value, "MiB", "Mean")}
                build={([available, total], grid) => [
                  sample("total", "Total", color(2), "line", valuesOn(grid, pointsOf(total), mean)),
                  sample(
                    "used",
                    "Used",
                    color(1),
                    "area",
                    memoryUsedMiB(placeOnGrid(grid, pointsOf(available)), placeOnGrid(grid, pointsOf(total))),
                  ),
                ]}
              />
              <HostSampleCard
                scope={scope}
                title="Boxes"
                metrics={["host.boxes.running", "host.boxes.warm"]}
                caption="Boxes, mean"
                format={(value) => formatValue(value, "{box}", "Mean")}
                reference={capacity === undefined ? undefined : { value: capacity, label: "Capacity now" }}
                build={([running, warm], grid) => [
                  sample("running", "Running", color(1), "step", valuesOn(grid, pointsOf(running), mean)),
                  sample("warm", "Warm", color(2), "step", valuesOn(grid, pointsOf(warm), mean)),
                ]}
              />
              <OutcomeCard scope={scope} />
              <HarnessStartupCard scope={scope} />
              <HostDroppedCard scope={scope} />
            </div>
          </div>
        );
      }}
    </MetricsPage>
  );
};
