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

const HOST_IDS = ["hst_placeholder01", "hst_placeholder02", "hst_placeholder03"];

const TURN_FACETS = {
  harness: ["ClaudeCode", "Codex", "PiDev"],
  harnessVersion: ["1.4.2", "1.5.0"],
  model: ["placeholder-model-a", "placeholder-model-b"],
  outcome: ["Completed", "Withdrawn", "CloneFailed", "Failed"],
  startKind: ["Cold", "Warm"],
  hostId: HOST_IDS,
};

const HOST_FACETS = { hostId: HOST_IDS };

const OUTCOME_COUNT: Record<string, number> = { Completed: 14, Withdrawn: 2, CloneFailed: 1, Failed: 1 };

const PHASE_SHARE: Record<string, number> = {
  Claim: 0.05,
  ImageFetch: 0.25,
  Restore: 0.1,
  Boot: 0.2,
  Clone: 0.15,
  FirstOutput: 0.25,
};

const PHASE_ORDER = ["Claim", "ImageFetch", "Restore", "Boot", "Clone", "FirstOutput"];

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
    entry("host.memory.total", "MiB", "Sample", "Memory the host has in total.", HOST_FACETS),
    entry("host.load.1m", "1", "Sample", "Load average over one minute.", HOST_FACETS),
    entry("host.load.5m", "1", "Sample", "Load average over five minutes.", HOST_FACETS),
    entry("host.load.15m", "1", "Sample", "Load average over fifteen minutes.", HOST_FACETS),
    entry("host.boxes.running", "{box}", "Sample", "Boxes running or paused.", HOST_FACETS),
    entry("host.boxes.warm", "{box}", "Sample", "Paused boxes kept warm.", HOST_FACETS),
    entry("telemetry.dropped", "{point}", "Sample", "Points the host dropped.", HOST_FACETS),
  ],
};

const BASE: Record<string, number> = {
  "turn.startup": 4.2,
  "turn.phase": 0.8,
  "turn.end": 1,
  "turn.cost": 180_000,
  "host.cpu.busy": 0.35,
  "host.memory.available": 24_000,
  "host.memory.total": 65_536,
  "host.load.1m": 3.2,
  "host.load.5m": 2.9,
  "host.load.15m": 2.4,
  "host.boxes.running": 3,
  "host.boxes.warm": 2,
  "telemetry.dropped": 0,
};

const FLAT = new Set(["host.memory.total", "host.boxes.running", "host.boxes.warm"]);

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

const factorFor = (metric: MetricEntry, group: Record<string, string>, filter: readonly string[]): number => {
  const picked = (dimension: string): string | undefined =>
    group[dimension] ?? filter.find((item) => item.startsWith(`${dimension}:`))?.slice(dimension.length + 1);
  const host = HOST_IDS.indexOf(picked("hostId") ?? "");
  const hostFactor = host < 0 ? 1 : 1 + host * 0.35;
  if (metric.metric === "turn.phase") return (PHASE_SHARE[picked("phase") ?? ""] ?? 0.2) * 5.2;
  if (metric.metric === "host.memory.total") return 1;
  return hostFactor;
};

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
      if (metric.kind === "Turn" && (index * 5 + column * 3) % 11 === 0) continue;
      const wave = FLAT.has(metric.metric) ? 1 : 1 + 0.3 * Math.sin(index / 3 + column);
      const dropping = metric.metric === "telemetry.dropped";
      const hostId = group.hostId ?? filter.find((item) => item.startsWith("hostId:"))?.slice(7);
      const value = dropping
        ? hostId === "hst_placeholder03" && index % 5 === 0
          ? 12
          : 0
        : base * wave * factorFor(metric, group, filter) * (group.hostId === undefined ? 1 + column * 0.2 : 1);
      const outcomeWeight = OUTCOME_COUNT[group.outcome ?? "Completed"] ?? 1;
      const count = metric.kind === "Turn" ? (1 + ((index * 7 + column * 3) % 9)) * outcomeWeight : size / 10_000;
      points.push({
        bucketStart: zoned(at, offsetOf(from)),
        count,
        sum: value * count,
        min: value * 0.4,
        max: value * (metric.kind === "Sample" ? 1.25 : 2.1),
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

const phasePoints = (
  turnId: string,
  sessionId: string,
  endsAt: number,
  startup: number,
  offset: number,
  dimensions: Record<string, string>,
): MetricTurnPoint[] => {
  let end = endsAt - startup * 1000;
  return PHASE_ORDER.map((phase) => {
    const value = startup * (PHASE_SHARE[phase] ?? 0);
    end += value * 1000;
    return { turnId, sessionId, at: zoned(end, offset), value, dimensions: { ...dimensions, phase } };
  });
};

const sessionStartupPage = (metric: string, sessionId: string, from: string) => {
  const offset = offsetOf(from);
  const points = [1, 2, 3].flatMap((index) => {
    const turnId = `trn_${sessionId}_${index}`;
    const endsAt = Date.parse(from) + index * 600_000;
    const startup = 2.6 + index * 0.9;
    const dimensions = {
      harness: "ClaudeCode",
      model: "placeholder-model-a",
      startKind: index === 1 ? "Cold" : "Warm",
    };
    if (metric === "turn.startup") {
      return [{ turnId, sessionId, at: zoned(endsAt, offset), value: startup, dimensions }];
    }
    return phasePoints(turnId, sessionId, endsAt, startup, offset, dimensions);
  });
  return { points, cursor: "", finished: true };
};

const BUCKET_SIZES = [86_400_000, 3_600_000, 60_000];

const bucketPhasePage = (query: { from: string; to: string }) => {
  const offset = offsetOf(query.from);
  const span = Date.parse(query.to) - Date.parse(query.from);
  const size = BUCKET_SIZES.find((candidate) => span >= candidate && span - candidate < 600_000) ?? 3_600_000;
  const bucketStart = Date.parse(query.to) - size;
  const points = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((index) => {
    const turn = turnPoint(index, zoned(bucketStart, offset), findMetric("turn.startup"));
    return phasePoints(turn.turnId, turn.sessionId, Date.parse(turn.at), turn.value, offset, turn.dimensions);
  });
  return { points, cursor: "", finished: true };
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
    if (query.sessionId !== undefined) {
      return metric === "turn.cost"
        ? sessionCostPage(query.sessionId, query.from)
        : sessionStartupPage(metric, query.sessionId, query.from);
    }
    if (metric === "turn.phase") return bucketPhasePage(query);
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
