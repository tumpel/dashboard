import { CostBasisSchema } from "@tumpel/schemas";
import type {
  MetricBucket,
  MetricKind,
  MetricPoint,
  MetricSeries,
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

export const MAX_CUSTOM_AGE_MS = 400 * DAY_MS;

export interface Span {
  from: number;
  to: number;
}

export const spanFor = (range: MetricRange, now: number): Span => {
  const to = Math.ceil(now / MINUTE_MS) * MINUTE_MS;
  return { from: to - RANGE_MS[range], to };
};

export const fittingBuckets = (span: Span, now: number): MetricBucket[] =>
  BUCKETS.filter((bucket) => {
    if (bucket === "Minute" && span.from < now - MINUTE_RETENTION_MS) return false;
    return Math.ceil((span.to - span.from) / BUCKET_MS[bucket]) + 1 <= MAX_BUCKETS;
  });

export const bucketFor = (span: Span, now: number, chosen: MetricBucket | undefined): MetricBucket => {
  const fitting = fittingBuckets(span, now);
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

export const windowOf = (span: Span, offsetMinutes: number): MetricWindow => ({
  from: zoned(span.from, offsetMinutes),
  to: zoned(span.to, offsetMinutes),
});

export const windowFor = (range: MetricRange, now: number, offsetMinutes: number): MetricWindow =>
  windowOf(spanFor(range, now), offsetMinutes);

export const offsetLabel = (offsetMinutes: number): string => `UTC${zoned(0, offsetMinutes).slice(-6)}`;

export const localInput = (epochMs: number, offsetMinutes: number): string =>
  zoned(epochMs, offsetMinutes).slice(0, 16);

export const parseLocalInput = (value: string, offsetMinutes: number): number =>
  Date.parse(`${value}:00${zoned(0, offsetMinutes).slice(-6)}`);

export const CUSTOM_RANGE_RULE =
  "The range must end now or earlier, start before it ends, and start within the last 400 days.";

export const customRangeValid = (span: Span, now: number): boolean =>
  span.from < span.to && span.to <= now && span.from >= now - MAX_CUSTOM_AGE_MS;

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

export const bucketMs = (bucket: MetricBucket): number => BUCKET_MS[bucket];

export const turnsQuery = (window: MetricWindow, filter: readonly string[], cursor: string): MetricTurnQuery => ({
  ...window,
  ...(filter.length > 0 && { filter: [...filter] }),
  ...(cursor !== "" && { cursor }),
});

export const bucketWindow = (bucketStart: string, bucket: MetricBucket): MetricWindow => ({
  from: bucketStart,
  to: bucketEnd(bucketStart, bucket),
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
  if (unit === "s") return value !== 0 && Math.abs(value) < 1 ? `${plain(value * 1000, 0)} ms` : `${plain(value, 2)} s`;
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
  dashboard: "" | "/startup" | "/hosts";
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
    dashboard: "",
  },
  {
    label: "Startup today by harness",
    metric: "turn.startup",
    range: "24h",
    bucket: "Day",
    groupBy: "harness",
    stats: ["p50", "p90"],
    empty: "No turns started yet.",
    dashboard: "/startup",
  },
  {
    label: "Host CPU busy this hour",
    metric: "host.cpu.busy",
    range: "24h",
    bucket: "Hour",
    groupBy: "hostId",
    stats: ["Mean"],
    empty: "No host has reported load yet.",
    dashboard: "/hosts",
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

export const bucketGrid = (window: MetricWindow, bucket: MetricBucket): number[] => {
  const size = BUCKET_MS[bucket];
  const offset = offsetMinutesOf(window.from) * MINUTE_MS;
  const from = Date.parse(window.from);
  const first = bucket === "Day" ? Math.floor((from + offset) / size) * size - offset : Math.floor(from / size) * size;
  const grid: number[] = [];
  for (let start = first; start < Date.parse(window.to); start += size) grid.push(start);
  return grid;
};

export const placeOnGrid = (grid: readonly number[], points: readonly MetricPoint[]): (MetricPoint | undefined)[] => {
  const byStart = new Map(points.map((point) => [Date.parse(point.bucketStart), point]));
  return grid.map((start) => byStart.get(start));
};

export type GridValues = (number | undefined)[];

export const valuesOn = (
  grid: readonly number[],
  points: readonly MetricPoint[],
  read: (point: MetricPoint) => number,
): GridValues => placeOnGrid(grid, points).map((point) => (point === undefined ? undefined : read(point)));

export const latestValue = (values: readonly (number | undefined)[]): number | undefined =>
  values.findLast((value) => value !== undefined);

export const memoryUsedShare = (
  available: readonly (MetricPoint | undefined)[],
  total: readonly (MetricPoint | undefined)[],
): GridValues =>
  total.map((totalPoint, index) => {
    const availablePoint = available[index];
    if (availablePoint === undefined || totalPoint === undefined) return undefined;
    return 1 - statOf(availablePoint, "Mean") / statOf(totalPoint, "Mean");
  });

export const memoryUsedMiB = (
  available: readonly (MetricPoint | undefined)[],
  total: readonly (MetricPoint | undefined)[],
): GridValues =>
  total.map((totalPoint, index) => {
    const availablePoint = available[index];
    if (availablePoint === undefined || totalPoint === undefined) return undefined;
    return statOf(totalPoint, "Mean") - statOf(availablePoint, "Mean");
  });

export const SUCCESS_OUTCOMES: readonly string[] = ["Completed", "Withdrawn"];

export const isFailure = (outcome: string): boolean => !SUCCESS_OUTCOMES.includes(outcome);

export interface FailureShare {
  failed: number;
  total: number;
  share: number;
}

export const failureShare = (set: MetricSeriesSet): FailureShare => {
  let failed = 0;
  let total = 0;
  for (const series of set.series) {
    const count = series.points.reduce((sum, point) => sum + point.count, 0);
    total += count;
    if (isFailure(series.group.outcome ?? "")) failed += count;
  }
  return { failed, total, share: total === 0 ? 0 : failed / total };
};

export const PHASES = ["Claim", "ImageFetch", "Restore", "Boot", "Clone", "FirstOutput"] as const;

const PHASE_COLOR_ORDER: readonly string[] = ["ImageFetch", "FirstOutput", "Claim", "Restore", "Boot", "Clone"];

export const CATEGORY_COLORS = 8;

export const NEUTRAL_COLOR = "var(--chart-neutral)";
export const CRITICAL_COLOR = "var(--chart-critical)";

const colorAt = (index: number): string =>
  index < 0 || index >= CATEGORY_COLORS ? NEUTRAL_COLOR : `var(--chart-${index + 1})`;

export const entityColor = (dimension: string, value: string, facetValues: readonly string[]): string => {
  if (value === OTHER_GROUP) return NEUTRAL_COLOR;
  if (dimension === "phase") return colorAt(PHASE_COLOR_ORDER.indexOf(value));
  if (dimension === "outcome") {
    if (value === "Withdrawn") return NEUTRAL_COLOR;
    return isFailure(value) ? CRITICAL_COLOR : colorAt(0);
  }
  return colorAt([...facetValues].sort().indexOf(value));
};

export const WATERFALL_DASHES: readonly (string | undefined)[] = [undefined, "6 3", "2 3", "10 3 2 3"];

export const phaseWindow = (bucketStart: string, bucket: MetricBucket, maxStartupSeconds: number): MetricWindow => ({
  from: zoned(Date.parse(bucketStart) - Math.ceil(maxStartupSeconds / 60) * MINUTE_MS, offsetMinutesOf(bucketStart)),
  to: bucketEnd(bucketStart, bucket),
});

export interface PhaseBar {
  phase: string;
  startSeconds: number;
  seconds: number;
}

export interface TurnWaterfall {
  turnId: string;
  startedAt: number;
  startupSeconds: number | undefined;
  totalSeconds: number;
  bars: PhaseBar[];
}

export const waterfalls = (
  phases: readonly MetricTurnPoint[],
  startups: readonly MetricTurnPoint[],
): TurnWaterfall[] => {
  const byTurn = new Map<string, MetricTurnPoint[]>();
  for (const point of phases) byTurn.set(point.turnId, [...(byTurn.get(point.turnId) ?? []), point]);
  const startupOf = new Map(startups.map((point) => [point.turnId, point.value]));
  return [...byTurn.entries()]
    .map(([turnId, points]) => {
      const spans = points.map((point) => ({
        phase: point.dimensions.phase ?? "",
        start: Date.parse(point.at) - point.value * 1000,
        seconds: point.value,
      }));
      const startedAt = Math.min(...spans.map((span) => span.start));
      const finishedAt = Math.max(...spans.map((span) => span.start + span.seconds * 1000));
      return {
        turnId,
        startedAt,
        startupSeconds: startupOf.get(turnId),
        totalSeconds: (finishedAt - startedAt) / 1000,
        bars: spans
          .map((span) => ({ phase: span.phase, startSeconds: (span.start - startedAt) / 1000, seconds: span.seconds }))
          .sort((left, right) => left.startSeconds - right.startSeconds),
      };
    })
    .sort((left, right) => left.startedAt - right.startedAt);
};

const dayMonth = (epochMs: number, offsetMinutes: number): string => {
  const local = new Date(epochMs + offsetMinutes * MINUTE_MS);
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}`;
};

export const clockLabel = (epochMs: number, offsetMinutes: number): string =>
  zoned(epochMs, offsetMinutes).slice(11, 16);

export const tickLabel = (epochMs: number, bucket: MetricBucket, spanMs: number, offsetMinutes: number): string => {
  if (bucket === "Day") return dayMonth(epochMs, offsetMinutes);
  if (spanMs >= 18 * HOUR_MS) return `${dayMonth(epochMs, offsetMinutes)} ${clockLabel(epochMs, offsetMinutes)}`;
  return clockLabel(epochMs, offsetMinutes);
};

export const bucketSpanLabel = (epochMs: number, bucket: MetricBucket, offsetMinutes: number): string => {
  if (bucket === "Day") return `${dayMonth(epochMs, offsetMinutes)}`;
  const end = epochMs + BUCKET_MS[bucket];
  return `${clockLabel(epochMs, offsetMinutes)} to ${clockLabel(end, offsetMinutes)}`;
};

export const percentLabel = (ratio: number): string => `${plain(ratio * 100, 0)}%`;

export const sumByBucket = (grid: readonly number[], sets: readonly MetricSeries[], stat: MetricStat): GridValues =>
  grid.map((start) => {
    const points = sets.flatMap((series) => series.points.filter((point) => Date.parse(point.bucketStart) === start));
    return points.length === 0 ? undefined : points.reduce((total, point) => total + statOf(point, stat), 0);
  });

export const latestBucket = (set: MetricSeriesSet): MetricPoint | undefined =>
  latestByGroup(set)
    .map(({ point }) => point)
    .reduce<MetricPoint | undefined>(
      (latest, point) =>
        latest === undefined || Date.parse(point.bucketStart) > Date.parse(latest.bucketStart) ? point : latest,
      undefined,
    );

export const metricMissing = (metrics: readonly { metric: string }[], metric: string): boolean =>
  !metrics.some((entry) => entry.metric === metric);

export const bucketTitle = (epochMs: number, bucket: MetricBucket, offsetMinutes: number): string =>
  bucket === "Day"
    ? dayMonth(epochMs, offsetMinutes)
    : `${dayMonth(epochMs, offsetMinutes)} ${bucketSpanLabel(epochMs, bucket, offsetMinutes)}`;
