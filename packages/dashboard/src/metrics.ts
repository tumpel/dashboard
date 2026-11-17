import { CostBasisSchema } from "@tumpel/schemas";
import type {
  MetricBucket,
  MetricKind,
  MetricPoint,
  MetricSeriesQuery,
  MetricSeriesSet,
  MetricTurnPoint,
  MetricTurnQuery,
  MetricWindow,
} from "./api/port";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const MAX_BUCKETS = 500;
export const MINUTE_RETENTION_MS = 8 * DAY_MS;
export const OTHER_GROUP = "Other";

export const RANGES = ["1h", "6h", "24h", "7d", "30d", "90d"] as const;
export type MetricRange = (typeof RANGES)[number];

export const RANGE_LABELS: Record<MetricRange, string> = {
  "1h": "Last hour",
  "6h": "Last 6 hours",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const RANGE_MS: Record<MetricRange, number> = {
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
};

export const BUCKETS = ["Minute", "Hour", "Day"] as const satisfies readonly MetricBucket[];

const BUCKET_MS: Record<MetricBucket, number> = { Minute: MINUTE_MS, Hour: HOUR_MS, Day: DAY_MS };

export const STATS = ["Count", "Sum", "Mean", "Min", "Max", "p50", "p90", "p99"] as const;
export type MetricStat = (typeof STATS)[number];

export const fittingBuckets = (range: MetricRange): MetricBucket[] =>
  BUCKETS.filter((bucket) => {
    const span = RANGE_MS[range];
    if (bucket === "Minute" && span > MINUTE_RETENTION_MS) return false;
    return Math.ceil(span / BUCKET_MS[bucket]) + 1 <= MAX_BUCKETS;
  });

export const bucketFor = (range: MetricRange, chosen: MetricBucket | undefined): MetricBucket => {
  const fitting = fittingBuckets(range);
  if (chosen !== undefined && fitting.includes(chosen)) return chosen;
  return fitting[0] ?? "Day";
};

const pad = (value: number): string => String(value).padStart(2, "0");

export const zoned = (epochMs: number, offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const size = Math.abs(offsetMinutes);
  const local = new Date(epochMs + offsetMinutes * MINUTE_MS).toISOString().slice(0, 19);
  return `${local}${sign}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
};

const offsetMinutesOf = (at: string): number => {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(at);
  if (match === null) return 0;
  const [, sign, hours, minutes] = match;
  return (Number(hours) * 60 + Number(minutes)) * (sign === "-" ? -1 : 1);
};

export const windowFor = (range: MetricRange, now: number, offsetMinutes: number): MetricWindow => {
  const to = Math.ceil(now / MINUTE_MS) * MINUTE_MS;
  return { from: zoned(to - RANGE_MS[range], offsetMinutes), to: zoned(to, offsetMinutes) };
};

export const seriesQuery = (
  window: MetricWindow,
  bucket: MetricBucket,
  filter: readonly string[],
  groupBy: readonly string[],
): MetricSeriesQuery => ({
  from: window.from,
  to: window.to,
  bucket,
  ...(filter.length > 0 && { filter: [...filter] }),
  ...(groupBy.length > 0 && { groupBy: groupBy.slice(0, 2) }),
});

export const filterEntry = (dimension: string, value: string): string => `${dimension}:${value}`;

const dimensionOf = (entry: string): string => entry.slice(0, entry.indexOf(":"));

export const toggleFilter = (filter: readonly string[], dimension: string, value: string): string[] => {
  const entry = filterEntry(dimension, value);
  return filter.includes(entry) ? filter.filter((item) => item !== entry) : [...filter, entry];
};

export const narrowTo = (filter: readonly string[], group: Record<string, string>): string[] | null => {
  const dimensions = Object.keys(group);
  if (dimensions.some((dimension) => group[dimension] === OTHER_GROUP)) return null;
  return [
    ...filter.filter((entry) => !dimensions.includes(dimensionOf(entry))),
    ...dimensions.map((dimension) => filterEntry(dimension, group[dimension] ?? "")),
  ];
};

export const bucketEnd = (bucketStart: string, bucket: MetricBucket): string =>
  zoned(Date.parse(bucketStart) + BUCKET_MS[bucket], offsetMinutesOf(bucketStart));

export const turnsQuery = (
  bucketStart: string,
  bucket: MetricBucket,
  filter: readonly string[],
  cursor: string,
): MetricTurnQuery => ({
  from: bucketStart,
  to: bucketEnd(bucketStart, bucket),
  ...(filter.length > 0 && { filter: [...filter] }),
  ...(cursor !== "" && { cursor }),
});

export const bucketLabel = (bucketStart: string, bucket: MetricBucket): string => {
  const day = bucketStart.slice(0, 10);
  return bucket === "Day" ? day : `${day} ${bucketStart.slice(11, 16)}`;
};

export const groupLabel = (group: Record<string, string>): string => {
  const values = Object.keys(group)
    .sort()
    .map((dimension) => group[dimension]);
  return values.length === 0 ? "All" : values.join(" · ");
};

export const defaultStat = (kind: MetricKind, unit: string): MetricStat => {
  if (kind === "Sample") return "Mean";
  return unit === "uUSD" || unit.startsWith("{") ? "Sum" : "p50";
};

export const statOf = (point: MetricPoint, stat: MetricStat): number => {
  if (stat === "Count") return point.count;
  if (stat === "Sum") return point.sum;
  if (stat === "Mean") return point.count === 0 ? 0 : point.sum / point.count;
  if (stat === "Min") return point.min;
  if (stat === "Max") return point.max;
  return point[stat];
};

const plain = (value: number, digits: number): string =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value).replace(/,/g, " ");

export const formatValue = (value: number, unit: string, stat: MetricStat): string => {
  if (stat === "Count") return plain(value, 0);
  if (unit === "uUSD") {
    const dollars = value / 1_000_000;
    return `$${dollars.toFixed(Math.abs(dollars) < 1 ? 4 : 2)}`;
  }
  if (unit === "s") return Math.abs(value) < 1 ? `${plain(value * 1000, 0)} ms` : `${plain(value, 2)} s`;
  if (unit === "MiB") return `${plain(value, 0)} MiB`;
  if (unit === "1" || unit.startsWith("{")) return plain(value, 2);
  return `${plain(value, 2)} ${unit}`;
};

export const unitLabel = (unit: string): string => {
  if (unit === "uUSD") return "US dollars";
  if (unit === "s") return "seconds";
  if (unit === "1") return "ratio";
  const counted = /^\{(.+)\}$/.exec(unit);
  return counted?.[1] ?? unit;
};

export interface BucketRow {
  bucketStart: string;
  cells: (MetricPoint | undefined)[];
}

export const bucketRows = (set: MetricSeriesSet): BucketRow[] => {
  const byStart = new Map<string, (MetricPoint | undefined)[]>();
  set.series.forEach((series, column) => {
    for (const point of series.points) {
      const cells = byStart.get(point.bucketStart) ?? Array.from({ length: set.series.length }, () => undefined);
      cells[column] = point;
      byStart.set(point.bucketStart, cells);
    }
  });
  return [...byStart.entries()]
    .sort(([left], [right]) => Date.parse(right) - Date.parse(left))
    .map(([bucketStart, cells]) => ({ bucketStart, cells }));
};

export const groupEntries = (group: Record<string, string>): string[] =>
  Object.keys(group)
    .sort()
    .map((dimension) => filterEntry(dimension, group[dimension] ?? ""));

export const groupOf = (entries: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    entries
      .filter((entry) => entry.indexOf(":") > 0)
      .map((entry) => [dimensionOf(entry), entry.slice(entry.indexOf(":") + 1)]),
  );

export interface MetricTile {
  label: string;
  metric: string;
  range: MetricRange;
  bucket: MetricBucket;
  groupBy: string;
  stats: MetricStat[];
  empty: string;
}

export const OVERVIEW_TILES: MetricTile[] = [
  {
    label: "Spend today by model",
    metric: "turn.cost",
    range: "30d",
    bucket: "Day",
    groupBy: "model",
    stats: ["Sum"],
    empty: "No spend reported yet.",
  },
  {
    label: "Startup today by harness",
    metric: "turn.startup",
    range: "24h",
    bucket: "Day",
    groupBy: "harness",
    stats: ["p50", "p90"],
    empty: "No turns started yet.",
  },
  {
    label: "Host CPU busy this hour",
    metric: "host.cpu.busy",
    range: "24h",
    bucket: "Hour",
    groupBy: "hostId",
    stats: ["Mean"],
    empty: "No host has reported load yet.",
  },
];

export interface LatestPoint {
  group: Record<string, string>;
  point: MetricPoint;
}

export const latestByGroup = (set: MetricSeriesSet): LatestPoint[] =>
  set.series.flatMap((series) => {
    const point = series.points.reduce<MetricPoint | undefined>(
      (latest, candidate) =>
        latest === undefined || Date.parse(candidate.bucketStart) > Date.parse(latest.bucketStart) ? candidate : latest,
      undefined,
    );
    return point === undefined ? [] : [{ group: series.group, point }];
  });

export const COST_METRIC = "turn.cost";

export interface CostTally {
  billed: number;
  notBilled: number;
  reported: boolean;
}

const NO_COST: CostTally = { billed: 0, notBilled: 0, reported: false };

export const costByTurn = (points: readonly MetricTurnPoint[]): Map<string, CostTally> => {
  const tallies = new Map<string, CostTally>();
  for (const point of points) {
    const tally = tallies.get(point.turnId) ?? NO_COST;
    const basis = CostBasisSchema.safeParse(point.dimensions.costBasis);
    if (!basis.success || basis.data === CostBasisSchema.enum.NotReported) {
      tallies.set(point.turnId, tally);
      continue;
    }
    const billed = basis.data === CostBasisSchema.enum.Billed;
    tallies.set(point.turnId, {
      billed: tally.billed + (billed ? point.value : 0),
      notBilled: tally.notBilled + (billed ? 0 : point.value),
      reported: true,
    });
  }
  return tallies;
};

export const sessionCost = (tallies: Iterable<CostTally>): CostTally =>
  [...tallies].reduce<CostTally>(
    (total, tally) => ({
      billed: total.billed + tally.billed,
      notBilled: total.notBilled + tally.notBilled,
      reported: total.reported || tally.reported,
    }),
    NO_COST,
  );

export const sinceWindow = (startedAt: number, now: number, offsetMinutes: number): MetricWindow => ({
  from: zoned(Math.floor(startedAt / MINUTE_MS) * MINUTE_MS, offsetMinutes),
  to: zoned(Math.ceil((now + 1) / MINUTE_MS) * MINUTE_MS, offsetMinutes),
});
