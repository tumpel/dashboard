import { Area, AreaChart, YAxis } from "recharts";
import type { GridValues } from "../metrics";
import { ChartContainer } from "./ui/chart";

export const Sparkline = ({
  values,
  color = "var(--chart-1)",
  height = 32,
}: {
  values: GridValues;
  color?: string;
  height?: number;
}) => (
  <ChartContainer height={height} aria-hidden>
    <AreaChart
      data={values.map((value, index) => ({ index, value: value ?? null }))}
      margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
      accessibilityLayer={false}
    >
      <YAxis hide domain={[0, "auto"]} />
      <Area
        dataKey="value"
        type="monotone"
        stroke={color}
        strokeWidth={1.5}
        fill={color}
        fillOpacity={0.2}
        connectNulls={false}
        isAnimationActive={false}
        dot={false}
        activeDot={false}
      />
    </AreaChart>
  </ChartContainer>
);
