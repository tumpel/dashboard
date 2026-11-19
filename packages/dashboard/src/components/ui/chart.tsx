import { TriangleAlertIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "../../lib";

export const ChartContainer = ({
  height,
  className,
  children,
  ...props
}: { height: number; children: ReactElementChild } & Omit<ComponentProps<"div">, "children">) => (
  <div
    className={cn(
      "w-full touch-pan-y text-xs select-none [&_.recharts-surface]:overflow-visible [&_.recharts-wrapper]:outline-none [&_svg:focus-visible]:rounded-sm [&_svg:focus-visible]:outline-2 [&_svg:focus-visible]:outline-ring",
      className,
    )}
    style={{ height }}
    {...props}
  >
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  </div>
);

type ReactElementChild = ComponentProps<typeof ResponsiveContainer>["children"];

export interface ChartEntry {
  key: string;
  label: string;
  color: string;
  dash?: string | undefined;
  warning?: boolean | undefined;
  band?: boolean | undefined;
}

const Swatch = ({ entry }: { entry: ChartEntry }) => (
  <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden className="shrink-0">
    {entry.band === true ? (
      <rect x="0" y="1" width="18" height="8" rx="2" fill={entry.color} fillOpacity="0.3" />
    ) : (
      <line
        x1="0"
        y1="5"
        x2="18"
        y2="5"
        stroke={entry.color}
        strokeWidth="3"
        strokeLinecap="round"
        {...(entry.dash === undefined ? {} : { strokeDasharray: entry.dash })}
      />
    )}
  </svg>
);

const Label = ({ entry }: { entry: ChartEntry }) => (
  <span className="inline-flex items-center gap-1">
    {entry.warning === true && <TriangleAlertIcon className="size-3.5 text-destructive" aria-label="Failure" />}
    {entry.label}
  </span>
);

export const ChartTooltipBox = ({ title, rows }: { title: string; rows: { entry: ChartEntry; value: string }[] }) => (
  <div className="grid max-w-72 gap-1 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
    <div className="font-medium">{title}</div>
    <ul className="grid gap-0.5">
      {rows.map(({ entry, value }) => (
        <li key={entry.key} className="flex items-center gap-2">
          <Swatch entry={entry} />
          <span className="font-semibold tabular-nums">{value}</span>
          <span className="min-w-0 text-muted-foreground">
            <Label entry={entry} />
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export const ChartLegend = ({
  entries,
  selected,
  onPick,
  className,
}: {
  entries: ChartEntry[];
  selected: string | undefined;
  onPick: (key: string) => void;
  className?: string;
}) => (
  <ul
    aria-label="Legend"
    className={cn(
      "flex flex-wrap gap-x-3 gap-y-1 text-xs",
      entries.length > 8 && "max-h-24 overflow-y-auto pr-1",
      className,
    )}
  >
    {entries.map((entry) => (
      <li key={entry.key}>
        <button
          type="button"
          aria-pressed={selected === entry.key}
          onClick={() => onPick(entry.key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 hover:bg-accent",
            selected === entry.key && "bg-accent font-semibold",
          )}
        >
          <Swatch entry={entry} />
          <Label entry={entry} />
        </button>
      </li>
    ))}
  </ul>
);

export const ChartCaption = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground">{children}</p>
);
