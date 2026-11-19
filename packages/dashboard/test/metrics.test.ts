import assert from "node:assert/strict";
import { test } from "node:test";
import type { MetricPoint } from "../src/api/port.ts";
import {
  bucketFor,
  bucketGrid,
  bucketLabel,
  bucketRows,
  bucketWindow,
  costByTurn,
  customRangeValid,
  entityColor,
  failureShare,
  fittingBuckets,
  formatValue,
  latestByGroup,
  memoryUsedShare,
  narrowTo,
  phaseWindow,
  placeOnGrid,
  seriesQuery,
  sessionCost,
  sinceWindow,
  spanFor,
  turnsQuery,
  waterfalls,
  windowFor,
} from "../src/metrics.ts";

const point = (bucketStart: string, sum: number): MetricPoint => ({
  bucketStart,
  count: 1,
  sum,
  min: sum,
  max: sum,
  p50: sum,
  p90: sum,
  p99: sum,
});

const NOW = Date.parse("2026-11-15T13:02:11Z");

test("the bucket is the smallest one that keeps the range under 500 buckets", () => {
  assert.equal(bucketFor(spanFor("6h", NOW), NOW, undefined), "Minute");
  assert.equal(bucketFor(spanFor("24h", NOW), NOW, undefined), "Hour");
  assert.equal(bucketFor(spanFor("7d", NOW), NOW, undefined), "Hour");
  assert.equal(bucketFor(spanFor("30d", NOW), NOW, undefined), "Day");
});

test("a chosen bucket that does not fit the range falls back to one that does", () => {
  const span = spanFor("24h", NOW);
  assert.deepEqual(fittingBuckets(span, NOW), ["Hour", "Day"]);
  assert.equal(bucketFor(span, NOW, "Minute"), "Hour");
  assert.equal(bucketFor(span, NOW, "Day"), "Day");
});

test("Minute buckets need a window that starts within 8 days, however short it is", () => {
  const nineDaysAgo = NOW - 9 * 86_400_000;
  assert.deepEqual(fittingBuckets({ from: nineDaysAgo, to: nineDaysAgo + 3_600_000 }, NOW), ["Hour", "Day"]);
  assert.deepEqual(fittingBuckets({ from: NOW - 3_600_000, to: NOW }, NOW), ["Minute", "Hour", "Day"]);
});

test("a custom range must end by now, start before it ends and start within 400 days", () => {
  const day = 86_400_000;
  assert.equal(customRangeValid({ from: NOW - day, to: NOW }, NOW), true);
  assert.equal(customRangeValid({ from: NOW - day, to: NOW + 1 }, NOW), false);
  assert.equal(customRangeValid({ from: NOW - day, to: NOW - day }, NOW), false);
  assert.equal(customRangeValid({ from: NOW - 401 * day, to: NOW }, NOW), false);
  assert.equal(customRangeValid({ from: Number.NaN, to: NOW }, NOW), false);
});

test("the window ends on the next whole minute and carries the browser's offset", () => {
  const now = Date.parse("2026-11-15T13:02:11Z");
  assert.deepEqual(windowFor("1h", now, 120), {
    from: "2026-11-15T14:03:00+02:00",
    to: "2026-11-15T15:03:00+02:00",
  });
  assert.deepEqual(windowFor("24h", now, -330), {
    from: "2026-11-14T07:33:00-05:30",
    to: "2026-11-15T07:33:00-05:30",
  });
});

test("a series query leaves out empty filters and keeps at most two groups", () => {
  const window = { from: "2026-11-15T14:00:00+01:00", to: "2026-11-15T15:00:00+01:00" };
  assert.deepEqual(seriesQuery(window, "Minute", [], []), { ...window, bucket: "Minute" });
  assert.deepEqual(seriesQuery(window, "Hour", ["harness:Codex"], ["hostId", "model", "outcome"]), {
    ...window,
    bucket: "Hour",
    filter: ["harness:Codex"],
    groupBy: ["hostId", "model"],
  });
});

test("narrowing to a group replaces the filters on its dimensions", () => {
  assert.deepEqual(narrowTo(["harness:Codex", "harness:PiDev", "outcome:Failed"], { harness: "ClaudeCode" }), [
    "outcome:Failed",
    "harness:ClaudeCode",
  ]);
  assert.equal(narrowTo([], { harness: "Other" }), null);
});

test("the turns behind a Day bucket span one day in the bucket's own offset", () => {
  assert.deepEqual(turnsQuery(bucketWindow("2026-11-15T00:00:00+02:00", "Day"), ["hostId:hst_a"], ""), {
    from: "2026-11-15T00:00:00+02:00",
    to: "2026-11-16T00:00:00+02:00",
    filter: ["hostId:hst_a"],
  });
  assert.deepEqual(turnsQuery(bucketWindow("2026-11-15T23:59:00-03:00", "Minute"), [], "next"), {
    from: "2026-11-15T23:59:00-03:00",
    to: "2026-11-16T00:00:00-03:00",
    cursor: "next",
  });
});

test("bucket labels read the wall clock of the answered offset", () => {
  assert.equal(bucketLabel("2026-11-15T14:00:00+01:00", "Hour"), "2026-11-15 14:00");
  assert.equal(bucketLabel("2026-11-15T00:00:00-05:00", "Day"), "2026-11-15");
});

test("rows hold one cell per series, newest bucket first, with gaps left empty", () => {
  const rows = bucketRows({
    metric: "turn.startup",
    unit: "s",
    bucket: "Hour",
    series: [
      { group: { harness: "Codex" }, points: [point("2026-11-15T13:00:00+01:00", 1)] },
      {
        group: { harness: "PiDev" },
        points: [point("2026-11-15T13:00:00+01:00", 2), point("2026-11-15T14:00:00+01:00", 3)],
      },
    ],
  });
  assert.deepEqual(
    rows.map((row) => [row.bucketStart, row.cells.map((cell) => cell?.sum)]),
    [
      ["2026-11-15T14:00:00+01:00", [undefined, 3]],
      ["2026-11-15T13:00:00+01:00", [1, 2]],
    ],
  );
});

test("values read in the metric's unit", () => {
  assert.equal(formatValue(0.42, "s", "p50"), "420 ms");
  assert.equal(formatValue(4.256, "s", "p90"), "4.26 s");
  assert.equal(formatValue(182_500, "uUSD", "Sum"), "$0.1825");
  assert.equal(formatValue(12_340_000, "uUSD", "Sum"), "$12.34");
  assert.equal(formatValue(12_345.6, "MiB", "Mean"), "12 346 MiB");
  assert.equal(formatValue(3.5, "{turn}", "Count"), "4");
});

const costPoint = (turnId: string, value: number, costBasis: string) => ({
  turnId,
  sessionId: "ses_a",
  at: "2026-11-15T14:00:00+01:00",
  value,
  dimensions: { costBasis },
});

test("cost splits billed from not billed, and a NotReported point leaves the turn unreported", () => {
  const tallies = costByTurn([
    costPoint("trn_1", 100, "Billed"),
    costPoint("trn_1", 50, "NotBilled"),
    costPoint("trn_2", 30, "NotBilled"),
    costPoint("trn_3", 0, "NotReported"),
    costPoint("trn_4", 20, "Unknown"),
  ]);
  assert.deepEqual(tallies.get("trn_1"), { billed: 100, notBilled: 50, reported: true });
  assert.deepEqual(tallies.get("trn_3"), { billed: 0, notBilled: 0, reported: false });
  assert.deepEqual(tallies.get("trn_4"), { billed: 0, notBilled: 0, reported: false });
  assert.deepEqual(sessionCost(tallies.values()), { billed: 100, notBilled: 80, reported: true });
  assert.deepEqual(sessionCost([]), { billed: 0, notBilled: 0, reported: false });
});

test("a tile reads each group's newest bucket and skips groups with no points", () => {
  const latest = latestByGroup({
    metric: "host.cpu.busy",
    unit: "1",
    bucket: "Hour",
    series: [
      {
        group: { hostId: "hst_a" },
        points: [point("2026-11-15T14:00:00+01:00", 2), point("2026-11-15T13:00:00+01:00", 1)],
      },
      { group: { hostId: "hst_b" }, points: [] },
    ],
  });
  assert.deepEqual(
    latest.map((row) => [row.group.hostId, row.point.sum]),
    [["hst_a", 2]],
  );
});

test("a session's window starts on the minute it was created and ends after now", () => {
  assert.deepEqual(sinceWindow(Date.parse("2026-11-15T12:34:56Z"), Date.parse("2026-11-15T13:00:00Z"), 60), {
    from: "2026-11-15T13:34:00+01:00",
    to: "2026-11-15T14:01:00+01:00",
  });
});

test("points land on the full bucket grid and an empty bucket stays a gap", () => {
  const grid = bucketGrid({ from: "2026-11-15T13:30:00+01:00", to: "2026-11-15T16:10:00+01:00" }, "Hour");
  assert.deepEqual(
    grid.map((start) => new Date(start).toISOString()),
    ["2026-11-15T12:00:00.000Z", "2026-11-15T13:00:00.000Z", "2026-11-15T14:00:00.000Z", "2026-11-15T15:00:00.000Z"],
  );
  const placed = placeOnGrid(grid, [point("2026-11-15T14:00:00+01:00", 1), point("2026-11-15T16:00:00+01:00", 2)]);
  assert.deepEqual(
    placed.map((cell) => cell?.sum),
    [undefined, 1, undefined, 2],
  );
});

test("Day buckets start at midnight in the offset of the window", () => {
  const grid = bucketGrid({ from: "2026-11-15T10:00:00-05:00", to: "2026-11-17T10:00:00-05:00" }, "Day");
  assert.deepEqual(
    grid.map((start) => new Date(start).toISOString()),
    ["2026-11-15T05:00:00.000Z", "2026-11-16T05:00:00.000Z", "2026-11-17T05:00:00.000Z"],
  );
});

const outcomePoint = (count: number) => ({ ...point("2026-11-15T13:00:00+01:00", count), count });

test("the failure share counts every outcome except Completed and Withdrawn", () => {
  const share = failureShare({
    metric: "turn.end",
    unit: "{turn}",
    bucket: "Hour",
    series: [
      { group: { outcome: "Completed" }, points: [outcomePoint(80), outcomePoint(10)] },
      { group: { outcome: "Withdrawn" }, points: [outcomePoint(10)] },
      { group: { outcome: "CloneFailed" }, points: [outcomePoint(3)] },
      { group: { outcome: "TimedOut" }, points: [outcomePoint(1)] },
    ],
  });
  assert.deepEqual(share, { failed: 4, total: 104, share: 4 / 104 });
});

test("memory used is one minus available over total, and a bucket missing either side is a gap", () => {
  const mean = (value: number) => ({ ...point("2026-11-15T13:00:00+01:00", value * 2), count: 2 });
  assert.deepEqual(memoryUsedShare([mean(2_000), undefined, mean(1_000)], [mean(8_000), mean(8_000), undefined]), [
    0.75,
    undefined,
    undefined,
  ]);
});

test("the phase window starts one rounded-up minute of max startup before the bucket", () => {
  assert.deepEqual(phaseWindow("2026-11-15T14:00:00+01:00", "Hour", 61), {
    from: "2026-11-15T13:58:00+01:00",
    to: "2026-11-15T15:00:00+01:00",
  });
  assert.deepEqual(phaseWindow("2026-11-15T14:00:00+01:00", "Hour", 0).from, "2026-11-15T14:00:00+01:00");
});

test("a waterfall places each phase from its end minus its duration, per turn", () => {
  const phase = (turnId: string, name: string, at: string, value: number) => ({
    turnId,
    sessionId: "ses_a",
    at,
    value,
    dimensions: { phase: name },
  });
  const turns = waterfalls(
    [
      phase("trn_1", "Boot", "2026-11-15T14:00:03Z", 2),
      phase("trn_1", "Claim", "2026-11-15T14:00:01Z", 1),
      phase("trn_1", "FirstOutput", "2026-11-15T14:00:04Z", 1),
    ],
    [{ ...phase("trn_1", "", "2026-11-15T14:00:04Z", 4), dimensions: {} }],
  );
  assert.deepEqual(turns, [
    {
      turnId: "trn_1",
      startedAt: Date.parse("2026-11-15T14:00:00Z"),
      startupSeconds: 4,
      totalSeconds: 4,
      bars: [
        { phase: "Claim", startSeconds: 0, seconds: 1 },
        { phase: "Boot", startSeconds: 1, seconds: 2 },
        { phase: "FirstOutput", startSeconds: 3, seconds: 1 },
      ],
    },
  ]);
});

test("a color follows its entity in the sorted catalog values, so a filter never repaints", () => {
  const harnesses = ["PiDev", "ClaudeCode", "Codex"];
  assert.equal(entityColor("harness", "ClaudeCode", harnesses), "var(--chart-1)");
  assert.equal(entityColor("harness", "PiDev", harnesses), "var(--chart-3)");
  assert.equal(entityColor("harness", "Other", harnesses), "var(--chart-neutral)");
  assert.equal(entityColor("phase", "FirstOutput", []), "var(--chart-2)");
  assert.equal(entityColor("outcome", "Withdrawn", []), "var(--chart-neutral)");
  assert.equal(entityColor("outcome", "CloneFailed", []), "var(--chart-critical)");
});
