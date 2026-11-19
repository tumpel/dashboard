import { entityColor, formatValue, PHASES, type PhaseBar, type TurnWaterfall } from "../metrics";

const seconds = (value: number): string => formatValue(value, "s", "p50");

const pct = (value: number, total: number): string => `${total === 0 ? 0 : (value / total) * 100}%`;

export const PhaseBars = ({ bars, totalSeconds, thin }: { bars: PhaseBar[]; totalSeconds: number; thin?: boolean }) => (
  <div
    role="img"
    aria-label={bars.map((bar) => `${bar.phase} ${seconds(bar.seconds)}`).join(", ")}
    className={`relative w-full overflow-hidden rounded-sm bg-muted ${thin === true ? "h-2" : "h-5"}`}
  >
    {bars.map((bar) => (
      <div
        key={bar.phase}
        title={`${bar.phase}: ${seconds(bar.seconds)}`}
        className="absolute inset-y-0 min-w-px border-r border-card"
        style={{
          left: pct(bar.startSeconds, totalSeconds),
          width: pct(bar.seconds, totalSeconds),
          background: entityColor("phase", bar.phase, []),
        }}
      />
    ))}
  </div>
);

export const PhaseLegend = () => (
  <ul aria-label="Phases" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
    {PHASES.map((phase) => (
      <li key={phase} className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: entityColor("phase", phase, []) }} aria-hidden />
        {phase}
      </li>
    ))}
  </ul>
);

export const StartupWaterfall = ({
  turns,
  labelOf,
}: {
  turns: TurnWaterfall[];
  labelOf: (turnId: string) => string;
}) => {
  const longest = Math.max(...turns.map((turn) => turn.totalSeconds));
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[7rem_1fr] items-center gap-2 text-xs text-muted-foreground sm:grid-cols-[10rem_1fr]">
        <span />
        <div className="flex justify-between">
          <span>0 s</span>
          <span>{seconds(longest / 2)}</span>
          <span>{seconds(longest)}</span>
        </div>
      </div>
      {turns.map((turn) => (
        <div key={turn.turnId} className="grid grid-cols-[7rem_1fr] items-center gap-2 sm:grid-cols-[10rem_1fr]">
          <div className="grid text-sm">
            <span className="truncate">{labelOf(turn.turnId)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {turn.startupSeconds === undefined ? "Startup not reported" : `Startup ${seconds(turn.startupSeconds)}`}
            </span>
          </div>
          <PhaseBars bars={turn.bars} totalSeconds={longest} />
        </div>
      ))}
      <PhaseLegend />
    </div>
  );
};
