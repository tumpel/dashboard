import { Sparkline } from "../components/sparkline";
import {
  bucketGrid,
  bucketSpanLabel,
  failureShare,
  formatValue,
  isFailure,
  latestBucket,
  sumByBucket,
} from "../metrics";
import { type CardScope, ChartCard, MISSING_TEXT, useSeries } from "./metrics-cards";

const percent = (share: number): string =>
  `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(share * 100)}%`;

export const StatTiles = ({ scope }: { scope: CardScope }) => {
  const { view, catalog } = scope;
  const ended = useSeries(scope, "turn.end", [], []);
  const byOutcome = useSeries(scope, "turn.end", ["outcome"], []);
  const startup = useSeries(scope, "turn.startup", [], []);
  const spend = useSeries(scope, "turn.cost", ["costBasis"], []);
  const grid = bucketGrid(view.window, view.bucket);
  const missing = (metric: string) =>
    catalog.metrics.some((entry) => entry.metric === metric) ? undefined : MISSING_TEXT[metric];
  const empty = "Nothing in this period.";
  const amount = (value: number): string => formatValue(value, "uUSD", "Sum");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChartCard title="Turns ended" queries={[ended]} missing={missing("turn.end")} height={72} emptyText={empty}>
        {([set]) =>
          set === undefined ? null : (
            <div className="grid gap-1">
              <div className="text-2xl font-semibold tabular-nums">
                {formatValue(
                  set.series.reduce(
                    (total, series) => total + series.points.reduce((sum, point) => sum + point.count, 0),
                    0,
                  ),
                  "{turn}",
                  "Count",
                )}
              </div>
              <Sparkline values={sumByBucket(grid, set.series, "Count")} />
            </div>
          )
        }
      </ChartCard>
      <ChartCard title="Failed" queries={[byOutcome]} missing={missing("turn.end")} height={72} emptyText={empty}>
        {([set]) => {
          if (set === undefined) return null;
          const { failed, share } = failureShare(set);
          return (
            <div className="grid gap-1">
              <div className="text-2xl font-semibold tabular-nums">
                {percent(share)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  ({formatValue(failed, "{turn}", "Count")})
                </span>
              </div>
              <Sparkline
                color="var(--chart-critical)"
                values={sumByBucket(
                  grid,
                  set.series.filter((series) => isFailure(series.group.outcome ?? "")),
                  "Count",
                )}
              />
            </div>
          );
        }}
      </ChartCard>
      <ChartCard
        title="Startup, latest bucket"
        queries={[startup]}
        missing={missing("turn.startup")}
        height={72}
        emptyText={empty}
      >
        {([set]) => {
          const latest = set === undefined ? undefined : latestBucket(set);
          if (set === undefined || latest === undefined) return null;
          return (
            <div className="grid gap-1">
              <div className="text-2xl font-semibold tabular-nums">
                p50 {formatValue(latest.p50, "s", "p50")}{" "}
                <span className="text-base font-normal">p90 {formatValue(latest.p90, "s", "p90")}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {bucketSpanLabel(Date.parse(latest.bucketStart), view.bucket, view.offsetMinutes)}
              </div>
              <Sparkline values={sumByBucket(grid, set.series, "p50")} />
            </div>
          );
        }}
      </ChartCard>
      <ChartCard title="Spend" queries={[spend]} missing={missing("turn.cost")} height={72} emptyText={empty}>
        {([set]) => {
          if (set === undefined) return null;
          const sum = (basis?: string): number =>
            set.series
              .filter((series) => basis === undefined || series.group.costBasis === basis)
              .reduce((total, series) => total + series.points.reduce((acc, point) => acc + point.sum, 0), 0);
          return (
            <div className="grid gap-1">
              <div className="text-2xl font-semibold tabular-nums">{amount(sum())}</div>
              <div className="text-xs text-muted-foreground">
                Billed {amount(sum("Billed"))} · Not billed {amount(sum("NotBilled"))}
              </div>
              <Sparkline values={sumByBucket(grid, set.series, "Sum")} />
            </div>
          );
        }}
      </ChartCard>
    </div>
  );
};
