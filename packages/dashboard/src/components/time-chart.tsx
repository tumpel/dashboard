import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricBucket } from "../api/port";
import { bucketMs, bucketTitle, type GridValues, NEUTRAL_COLOR, tickLabel } from "../metrics";
import { Button } from "./ui/button";
import { ChartCaption, ChartContainer, type ChartEntry, ChartLegend, ChartTooltipBox } from "./ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface TimeSeries {
  key: string;
  label: string;
  color: string;
  mark: "line" | "step" | "area" | "column" | "band";
  values: GridValues;
  upper?: GridValues;
  dash?: string;
  warning?: boolean;
  group?: Record<string, string>;
}

export interface TimeChartProps {
  grid: number[];
  bucket: MetricBucket;
  offsetMinutes: number;
  series: TimeSeries[];
  format: (value: number) => string;
  caption: string;
  height?: number;
  domain?: [number, number | "auto"];
  reference?: { value: number; label: string };
  onPoint?: (series: TimeSeries, at: number) => void;
  onSeries?: (series: TimeSeries) => void;
  onZoom?: (from: number, to: number) => void;
  tableToggle?: boolean;
}

type Row = Record<string, number | [number, number] | null>;

export const rowsOf = (grid: readonly number[], series: readonly TimeSeries[]): Row[] =>
  grid.map((at, index) => {
    const row: Row = { at };
    for (const item of series) {
      const value = item.values[index];
      const upper = item.upper?.[index];
      if (item.mark === "band") row[item.key] = value === undefined || upper === undefined ? null : [value, upper];
      else row[item.key] = value ?? null;
    }
    return row;
  });

const MANY = 8;

const SeriesTable = ({ grid, bucket, offsetMinutes, series, format }: TimeChartProps) => (
  <div className="max-h-80 overflow-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          {series.map((item) => (
            <TableHead key={item.key} className="text-right">
              {item.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...grid.keys()].reverse().map((index) => {
          const at = grid[index] ?? 0;
          return (
            <TableRow key={at}>
              <TableCell className="font-mono text-[13px] whitespace-nowrap">
                {bucketTitle(at, bucket, offsetMinutes)}
              </TableCell>
              {series.map((item) => {
                const value = item.values[index];
                const upper = item.upper?.[index];
                const text =
                  value === undefined
                    ? "-"
                    : item.mark === "band" && upper !== undefined
                      ? `${format(value)} to ${format(upper)}`
                      : format(value);
                return (
                  <TableCell key={item.key} className="text-right tabular-nums">
                    {text}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

const entryOf = (series: TimeSeries, color: string): ChartEntry => ({
  key: series.key,
  label: series.label,
  color,
  dash: series.dash,
  warning: series.warning,
  band: series.mark === "band",
});

export const TimeChart = (props: TimeChartProps) => {
  const { grid, bucket, offsetMinutes, series, format, caption, domain, reference, onPoint, onSeries, onZoom } = props;
  const [selected, setSelected] = useState<string | undefined>();
  const [hovered, setHovered] = useState<string | undefined>();
  const [drag, setDrag] = useState<{ from: number; to: number } | undefined>();
  const [asTable, setAsTable] = useState(false);
  const many = series.filter((item) => item.mark !== "band").length > MANY;
  const active = selected ?? hovered;
  const colorOf = (item: TimeSeries): string =>
    many && item.key !== active ? NEUTRAL_COLOR : many ? "var(--chart-1)" : item.color;
  const entries = series.map((item) => entryOf(item, colorOf(item)));
  const rows = rowsOf(grid, series);
  const span = (grid.at(-1) ?? 0) - (grid[0] ?? 0);
  const stacked = series.some((item) => item.mark === "column");
  const dimmed = (item: TimeSeries): number => (active !== undefined && !many && item.key !== active ? 0.35 : 1);
  const toolbar = props.tableToggle !== false && (
    <Button variant="outline" size="sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
      {asTable ? "Chart" : "Table"}
    </Button>
  );
  const tooltip = ({ active: open, payload, label }: TooltipContentProps) => {
    if (open !== true || payload.length === 0 || typeof label !== "number") return null;
    const listed = payload.flatMap((entry) => {
      const item = series.find((candidate) => candidate.key === entry.dataKey);
      const value: unknown = entry.value;
      if (item === undefined || value === null || value === undefined) return [];
      const text =
        Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number"
          ? `${format(value[0])} to ${format(value[1])}`
          : typeof value === "number"
            ? format(value)
            : null;
      return text === null ? [] : [{ entry: entryOf(item, colorOf(item)), value: text }];
    });
    return listed.length === 0 ? null : (
      <ChartTooltipBox title={bucketTitle(label, bucket, offsetMinutes)} rows={listed} />
    );
  };
  const clickPoint = (at: unknown) => {
    if (typeof at !== "number") return;
    const item =
      series.find((candidate) => candidate.key === hovered) ?? series.find((candidate) => candidate.mark !== "band");
    if (item !== undefined) onPoint?.(item, at);
  };
  const finishDrag = () => {
    if (drag === undefined) return;
    setDrag(undefined);
    if (drag.from === drag.to) return;
    onZoom?.(Math.min(drag.from, drag.to), Math.max(drag.from, drag.to) + bucketMs(bucket));
  };
  const labelOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <ChartCaption>{caption}</ChartCaption>
        {toolbar}
      </div>
      {asTable ? (
        <SeriesTable {...props} />
      ) : (
        <>
          <ChartContainer height={props.height ?? 240}>
            <ComposedChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              onMouseDown={(state) => {
                const at = labelOf(state.activeLabel);
                if (onZoom !== undefined && at !== undefined) setDrag({ from: at, to: at });
              }}
              onMouseMove={(state) => {
                const at = labelOf(state.activeLabel);
                if (drag !== undefined && at !== undefined) setDrag({ ...drag, to: at });
              }}
              onMouseUp={finishDrag}
              onMouseLeave={() => {
                setDrag(undefined);
                setHovered(undefined);
              }}
              onClick={(state) => {
                if (drag === undefined || drag.from === drag.to) if (!stacked) clickPoint(state.activeLabel);
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="at"
                tickFormatter={(value: number) => tickLabel(value, bucket, span, offsetMinutes)}
                minTickGap={32}
                tickMargin={6}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                width="auto"
                domain={domain ?? [0, "auto"]}
                tickFormatter={(value: number) => format(value)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
              />
              <Tooltip
                content={tooltip}
                isAnimationActive={false}
                shared={!stacked}
                cursor={
                  stacked
                    ? { fill: "var(--muted)", opacity: 0.5 }
                    : { stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }
                }
              />
              {reference !== undefined && (
                <ReferenceLine
                  y={reference.value}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: reference.label,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 12,
                  }}
                />
              )}
              {series.map((item) => {
                const color = colorOf(item);
                const common = { dataKey: item.key, name: item.label, isAnimationActive: false } as const;
                if (item.mark === "column") {
                  return (
                    <Bar
                      key={item.key}
                      {...common}
                      stackId="stack"
                      fill={color}
                      stroke="var(--card)"
                      strokeWidth={2}
                      maxBarSize={28}
                      cursor={onPoint === undefined ? undefined : "pointer"}
                      onClick={(data: { payload?: { at?: unknown } }) => onPoint?.(item, Number(data.payload?.at))}
                    />
                  );
                }
                if (item.mark === "band" || item.mark === "area") {
                  return (
                    <Area
                      key={item.key}
                      {...common}
                      type="monotone"
                      stroke={item.mark === "area" ? color : "none"}
                      strokeWidth={2}
                      fill={color}
                      fillOpacity={item.mark === "band" ? 0.25 : 0.3}
                      connectNulls={false}
                      activeDot={false}
                    />
                  );
                }
                return (
                  <Line
                    key={item.key}
                    {...common}
                    type={item.mark === "step" ? "stepAfter" : "monotone"}
                    stroke={color}
                    strokeWidth={many && item.key === active ? 3 : 2}
                    strokeOpacity={dimmed(item)}
                    strokeDasharray={item.dash}
                    dot={{ r: 2.5, fill: color, stroke: "var(--card)", strokeWidth: 1 }}
                    activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                    connectNulls={false}
                    onMouseEnter={() => setHovered(item.key)}
                    onClick={() => onSeries?.(item)}
                  />
                );
              })}
              {drag !== undefined && drag.from !== drag.to && (
                <ReferenceArea
                  x1={drag.from}
                  x2={drag.to}
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  stroke="var(--chart-1)"
                />
              )}
            </ComposedChart>
          </ChartContainer>
          {series.length > 1 && (
            <ChartLegend
              entries={entries}
              selected={selected}
              onPick={(key) => {
                const item = series.find((candidate) => candidate.key === key);
                if (onSeries !== undefined && item !== undefined) onSeries(item);
                else setSelected(selected === key ? undefined : key);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
