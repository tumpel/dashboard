import { CostBasisSchema } from "@tumpel/schemas";
import type {
  CostBasis,
  MetricBucket,
  MetricCatalog,
  MetricEntry,
  MetricSeries,
  MetricTurnPoint,
  TumpelApi,
} from "../api/port";
import { zoned } from "../metrics";

const TURN_FACETS = {
  harness: ["ClaudeCode", "Codex", "PiDev"],
  model: ["placeholder-model-a", "placeholder-model-b"],
  outcome: ["Completed", "Failed"],
  startKind: ["Cold", "Warm"],
  hostId: ["hst_placeholder01", "hst_placeholder02"],
};

const HOST_FACETS = { hostId: ["hst_placeholder01", "hst_placeholder02", "hst_placeholder03"] };

const facetsOf = (facets: Record<string, string[]>): MetricEntry["facets"] =>
  Object.entries(facets).map(([dimension, values]) => ({
    dimension,
    values: values.map((value, index) => ({ value, seriesCount: index + 2 })),
  }));

const entry = (
  metric: string,
  unit: string,
  kind: MetricEntry["kind"],
  description: string,
  facets: Record<string, string[]>,
): MetricEntry => ({ metric, unit, kind, description, facets: facetsOf(facets) });

export const METRIC_CATALOG: MetricCatalog = {
  metrics: [
    entry("turn.startup", "s", "Turn", "Time from the offer to the first harness line.", TURN_FACETS),
    entry("turn.phase", "s", "Turn", "Time each startup phase took.", {
      ...TURN_FACETS,
      phase: ["Boot", "Claim", "Clone", "FirstOutput", "ImageFetch"],
    }),
    entry("turn.end", "{turn}", "Turn", "Turns that ended.", TURN_FACETS),
    entry("turn.cost", "uUSD", "Turn", "What a turn cost.", {
      ...TURN_FACETS,
      costBasis: [CostBasisSchema.enum.Billed, CostBasisSchema.enum.NotBilled],
    }),
    entry("host.cpu.busy", "1", "Sample", "Share of CPU time the host spent busy.", HOST_FACETS),
    entry("host.memory.available", "MiB", "Sample", "Memory the host has free.", HOST_FACETS),
  ],
};

const BASE: Record<string, number> = {
  "turn.startup": 4.2,
  "turn.phase": 0.8,
  "turn.end": 1,
  "turn.cost": 180_000,
  "host.cpu.busy": 0.35,
  "host.memory.available": 9_000,
};

const BUCKET_MS: Record<MetricBucket, number> = { Minute: 60_000, Hour: 3_600_000, Day: 86_400_000 };

const offsetOf = (at: string): number => {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(at);
  if (match === null) return 0;
  return (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "-" ? -1 : 1);
};

const combinations = (dimensions: string[], values: Map<string, string[]>): Record<string, string>[] =>
  dimensions.reduce<Record<string, string>[]>(
    (groups, dimension) =>
      groups.flatMap((group) => (values.get(dimension) ?? []).map((value) => ({ ...group, [dimension]: value }))),
    [{}],
  );

const chosenValues = (metric: MetricEntry, filter: readonly string[]): Map<string, string[]> =>
  new Map(
    metric.facets.map((facet) => {
      const picked = filter
        .filter((item) => item.startsWith(`${facet.dimension}:`))
        .map((item) => item.slice(facet.dimension.length + 1));
      return [facet.dimension, picked.length > 0 ? picked : facet.values.map((value) => value.value)];
    }),
  );

const seriesFor = (
  metric: MetricEntry,
  from: string,
  to: string,
  bucket: MetricBucket,
  filter: readonly string[],
  groupBy: readonly string[],
): MetricSeries[] => {
  const offset = offsetOf(from) * 60_000;
  const size = BUCKET_MS[bucket];
  const start = Date.parse(from);
  const first =
    bucket === "Day" ? Math.floor((start + offset) / size) * size - offset : Math.floor(start / size) * size;
  const end = Date.parse(to);
  const base = BASE[metric.metric] ?? 1;
  return combinations([...groupBy], chosenValues(metric, filter)).map((group, column) => {
    const points = [];
    for (let at = first, index = 0; at < end; at += size, index += 1) {
      if (metric.kind === "Turn" && (index + column) % 4 === 0) continue;
      const wave = 1 + 0.3 * Math.sin(index / 3 + column);
      const value = base * wave * (1 + column * 0.2);
      const count = metric.kind === "Turn" ? 1 + ((index * 7 + column * 3) % 9) : size / 10_000;
      points.push({
        bucketStart: zoned(at, offsetOf(from)),
        count,
        sum: value * count,
        min: value * 0.4,
        max: value * 2.1,
        p50: value * 0.95,
        p90: value * 1.6,
        p99: value * 2,
      });
    }
    return { group, points };
  });
};

const findMetric = (metric: string): MetricEntry => {
  const found = METRIC_CATALOG.metrics.find((item) => item.metric === metric);
  if (found === undefined) throw new Error(`the story catalog has no metric ${metric}`);
  return found;
};

const turnPoint = (index: number, at: string, metric: MetricEntry): MetricTurnPoint => ({
  turnId: `trn_placeholder${String(index + 1).padStart(2, "0")}`,
  sessionId: `ses_${(index % 4) + 1}`,
  at: zoned(Date.parse(at) + index * 97_000, offsetOf(at)),
  value: (BASE[metric.metric] ?? 1) * (0.6 + (index % 5) * 0.2),
  dimensions: {
    harness: TURN_FACETS.harness[index % 3] ?? "ClaudeCode",
    hostId: TURN_FACETS.hostId[index % 2] ?? "hst_placeholder01",
    model: TURN_FACETS.model[index % 2] ?? "placeholder-model-a",
    outcome: index === 3 ? "Failed" : "Completed",
    startKind: index % 3 === 0 ? "Cold" : "Warm",
  },
});

const sessionCostPage = (sessionId: string, from: string) => {
  const cost = (index: number, value: number, costBasis: CostBasis): MetricTurnPoint => ({
    turnId: `trn_${sessionId}_${index}`,
    sessionId,
    at: zoned(Date.parse(from) + index * 600_000, offsetOf(from)),
    value,
    dimensions: { harness: "ClaudeCode", model: "placeholder-model-a", costBasis },
  });
  return {
    points: [
      cost(1, 182_500, CostBasisSchema.enum.Billed),
      cost(2, 64_000, CostBasisSchema.enum.NotBilled),
      cost(3, 0, CostBasisSchema.enum.NotReported),
    ],
    cursor: "",
    finished: true,
  };
};

export const CATALOG_WITHOUT_SPEND: MetricCatalog = {
  metrics: METRIC_CATALOG.metrics.filter((item) => item.metric !== "turn.cost"),
};

export const metricFakes = (): Pick<TumpelApi, "metricCatalog" | "queryMetric" | "metricTurns"> => ({
  metricCatalog: async () => METRIC_CATALOG,
  queryMetric: async (metric, query) => {
    const found = findMetric(metric);
    return {
      metric,
      unit: found.unit,
      bucket: query.bucket,
      series: seriesFor(found, query.from, query.to, query.bucket, query.filter ?? [], query.groupBy ?? []),
    };
  },
  metricTurns: async (metric, query) => {
    const found = findMetric(metric);
    if (query.sessionId !== undefined) return sessionCostPage(query.sessionId, query.from);
    const page = query.cursor === undefined ? 0 : 1;
    const indexes = page === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8];
    return {
      points: indexes.map((index) => {
        const turn = turnPoint(index, query.from, found);
        const picked = Object.fromEntries((query.filter ?? []).map((item) => item.split(":")));
        return { ...turn, dimensions: { ...turn.dimensions, ...picked } };
      }),
      cursor: page === 0 ? "placeholder-cursor" : "",
      finished: page === 1,
    };
  },
});
