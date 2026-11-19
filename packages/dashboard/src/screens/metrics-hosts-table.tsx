import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import type { MetricPoint } from "../api/port";
import { Sparkline } from "../components/sparkline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  bucketGrid,
  formatValue,
  type GridValues,
  latestValue,
  memoryUsedShare,
  percentLabel,
  placeOnGrid,
  valuesOn,
} from "../metrics";
import { type CardScope, ChartCard, facetValues, MISSING_TEXT, useSeries } from "./metrics-cards";
import { linkSearch } from "./metrics-view";

interface HostRow {
  hostId: string;
  name: string;
  cpu: GridValues;
  memory: GridValues;
  load: GridValues;
  running: GridValues;
  warm: GridValues;
}

const SORTS = ["name", "cpu", "memory", "load", "boxes"] as const;
type Sort = (typeof SORTS)[number];

const sortValue = (row: HostRow, sort: Sort): number | string => {
  if (sort === "name") return row.name;
  if (sort === "boxes") return latestValue(row.running) ?? -1;
  return latestValue(row[sort]) ?? -1;
};

const pointsOf = (
  set: { series: { group: Record<string, string>; points: MetricPoint[] }[] },
  hostId: string,
): MetricPoint[] => set.series.find((series) => series.group.hostId === hostId)?.points ?? [];

const roundedLatest = (values: GridValues): string => {
  const latest = latestValue(values);
  return latest === undefined ? "-" : String(Math.round(latest));
};

export const HostsTable = ({ scope, title = "Hosts" }: { scope: CardScope; title?: string }) => {
  const { view, catalog, hostNames } = scope;
  const [sort, setSort] = useState<Sort>("name");
  const cpu = useSeries(scope, "host.cpu.busy", ["hostId"], []);
  const available = useSeries(scope, "host.memory.available", ["hostId"], []);
  const total = useSeries(scope, "host.memory.total", ["hostId"], []);
  const load = useSeries(scope, "host.load.1m", ["hostId"], []);
  const running = useSeries(scope, "host.boxes.running", ["hostId"], []);
  const warm = useSeries(scope, "host.boxes.warm", ["hostId"], []);
  const grid = bucketGrid(view.window, view.bucket);
  const hostIds = facetValues(catalog, "host.cpu.busy", "hostId");
  return (
    <ChartCard
      title={title}
      queries={[cpu, available, total, load, running, warm]}
      missing={hostIds.length === 0 ? MISSING_TEXT["host.cpu.busy"] : undefined}
      height={160}
      emptyText="No host has reported load in this period."
    >
      {([cpuSet, availableSet, totalSet, loadSet, runningSet, warmSet]) => {
        if (!cpuSet || !availableSet || !totalSet || !loadSet || !runningSet || !warmSet) return null;
        const rows: HostRow[] = hostIds.map((hostId) => ({
          hostId,
          name: hostNames(hostId),
          cpu: valuesOn(grid, pointsOf(cpuSet, hostId), (point) => point.sum / point.count),
          memory: memoryUsedShare(
            placeOnGrid(grid, pointsOf(availableSet, hostId)),
            placeOnGrid(grid, pointsOf(totalSet, hostId)),
          ),
          load: valuesOn(grid, pointsOf(loadSet, hostId), (point) => point.sum / point.count),
          running: valuesOn(grid, pointsOf(runningSet, hostId), (point) => point.sum / point.count),
          warm: valuesOn(grid, pointsOf(warmSet, hostId), (point) => point.sum / point.count),
        }));
        const sorted = [...rows].sort((left, right) => {
          const a = sortValue(left, sort);
          const b = sortValue(right, sort);
          if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
          return Number(b) - Number(a);
        });
        const header = (key: Sort, label: string) => (
          <TableHead aria-sort={sort === key ? "descending" : "none"}>
            <button type="button" className="font-medium hover:underline" onClick={() => setSort(key)}>
              {label}
              {sort === key && key !== "name" ? " ↓" : ""}
            </button>
          </TableHead>
        );
        const cell = (values: GridValues, text: string, color?: string) => (
          <TableCell>
            <div className="flex items-center gap-2">
              <div className="w-20 shrink-0">
                <Sparkline values={values} height={28} {...(color === undefined ? {} : { color })} />
              </div>
              <span className="tabular-nums">{text}</span>
            </div>
          </TableCell>
        );
        return (
          <Table>
            <TableHeader>
              <TableRow>
                {header("name", "Host")}
                {header("cpu", "CPU busy")}
                {header("memory", "Memory used")}
                {header("load", "Load 1m")}
                {header("boxes", "Boxes")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => {
                const latestCpu = latestValue(row.cpu);
                const latestMemory = latestValue(row.memory);
                const latestLoad = latestValue(row.load);
                return (
                  <TableRow key={row.hostId}>
                    <TableCell>
                      <Link
                        to="/t/$tenantId/metrics/hosts/$hostId"
                        params={{ tenantId: view.tenantId, hostId: row.hostId }}
                        search={linkSearch(view.search, {})}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    {cell(row.cpu, latestCpu === undefined ? "-" : percentLabel(latestCpu))}
                    {cell(row.memory, latestMemory === undefined ? "-" : percentLabel(latestMemory))}
                    {cell(row.load, latestLoad === undefined ? "-" : formatValue(latestLoad, "1", "Mean"))}
                    <TableCell className="whitespace-nowrap">
                      {roundedLatest(row.running)} running, {roundedLatest(row.warm)} warm
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        );
      }}
    </ChartCard>
  );
};

export const DroppedBanner = ({ scope }: { scope: CardScope }) => {
  const { view, hostNames } = scope;
  const dropped = useSeries(scope, "telemetry.dropped", ["hostId"], []);
  const hostIds =
    dropped.data?.series
      .filter((series) => series.points.some((point) => point.sum > 0))
      .map((series) => series.group.hostId ?? "") ?? [];
  if (hostIds.length === 0) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border-2 border-warning bg-card p-3 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        Some measurements from{" "}
        {hostIds.map((hostId, index) => (
          <span key={hostId}>
            {index > 0 && ", "}
            <Link
              to="/t/$tenantId/metrics/hosts/$hostId"
              params={{ tenantId: view.tenantId, hostId }}
              search={linkSearch(view.search, {})}
              className="font-medium text-primary hover:underline"
            >
              {hostNames(hostId)}
            </Link>
          </span>
        ))}{" "}
        are missing for this period. The host dropped them because its buffer was full.
      </p>
    </div>
  );
};
