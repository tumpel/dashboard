import { Link } from "@tanstack/react-router";
import { ProblemBlock } from "../components/problem-block";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useClock } from "../context";
import {
  formatValue,
  groupLabel,
  latestByGroup,
  type MetricTile,
  OVERVIEW_TILES,
  seriesQuery,
  statOf,
  windowFor,
} from "../metrics";
import { useMetricCatalog, useMetricSeries } from "../queries";

const TileLink = ({ tenantId, tile, groupBy }: { tenantId: string; tile: MetricTile; groupBy: string[] }) => (
  <Link
    to="/t/$tenantId/metrics"
    params={{ tenantId }}
    search={{
      metric: [tile.metric],
      range: [tile.range],
      bucket: [tile.bucket],
      stat: tile.stats.slice(0, 1),
      filter: [],
      groupBy,
      at: [],
      group: [],
    }}
    className="text-sm text-primary hover:underline"
  >
    Open in Metrics
  </Link>
);

const TileBody = ({ tenantId, tile }: { tenantId: string; tile: MetricTile }) => {
  const now = useClock();
  const window = windowFor(tile.range, now(), -new Date(now()).getTimezoneOffset());
  const catalog = useMetricCatalog(tenantId, window);
  const entry = catalog.data?.metrics.find((item) => item.metric === tile.metric);
  const groupBy = entry?.facets.some((facet) => facet.dimension === tile.groupBy) ? [tile.groupBy] : [];
  const series = useMetricSeries(
    tenantId,
    entry === undefined ? null : tile.metric,
    seriesQuery(window, tile.bucket, [], groupBy),
  );
  if (catalog.isPending) return <Skeleton className="h-16 w-full" />;
  if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
  if (entry === undefined) return <p className="text-sm text-muted-foreground">{tile.empty}</p>;
  if (series.isPending) return <Skeleton className="h-16 w-full" />;
  if (series.isError) return <ProblemBlock error={series.error} onRetry={() => void series.refetch()} />;
  const latest = latestByGroup(series.data);
  return (
    <div className="grid gap-2">
      {latest.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tile.empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-medium">{tile.groupBy}</th>
              {tile.stats.map((stat) => (
                <th key={stat} className="text-right font-medium">
                  {stat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest.map(({ group, point }) => (
              <tr key={groupLabel(group)}>
                <td className="font-mono text-[13px]">{groupLabel(group)}</td>
                {tile.stats.map((stat) => (
                  <td key={stat} className="text-right font-semibold tabular-nums">
                    {formatValue(statOf(point, stat), series.data.unit, stat)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <TileLink tenantId={tenantId} tile={tile} groupBy={groupBy} />
    </div>
  );
};

export const MetricTiles = ({ tenantId }: { tenantId: string }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {OVERVIEW_TILES.map((tile) => (
      <Card key={tile.metric}>
        <CardHeader>
          <CardTitle>{tile.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <TileBody tenantId={tenantId} tile={tile} />
        </CardContent>
      </Card>
    ))}
  </div>
);
