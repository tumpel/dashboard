import { CheckIcon, ClockIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib";

export const Status = ({
  kind,
  title,
  children,
}: {
  kind: "Done" | "Waiting";
  title: string;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      "flex items-start gap-3 rounded-md border p-4",
      kind === "Done" ? "border-primary bg-card" : "bg-muted",
    )}
  >
    {kind === "Done" ? (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-4" aria-hidden />
      </span>
    ) : (
      <ClockIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    )}
    <div className="grid gap-0.5">
      <h3 className="font-semibold">{title}</h3>
      {children !== undefined && <div className="text-sm">{children}</div>}
    </div>
  </div>
);

export const Rows = ({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }) => (
  <dl className="grid rounded-md border text-sm">
    {rows.map(([label, value]) => (
      <div key={label} className="grid gap-0.5 border-t px-3 py-2 first:border-t-0 sm:grid-cols-[9rem_1fr] sm:gap-3">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 break-words">{value}</dd>
      </div>
    ))}
  </dl>
);

type CopyOutcome = "Idle" | "Copied" | "Blocked";

export const CopyBlock = ({
  text,
  label,
  noun,
  onCopy,
}: {
  text: string;
  label: string;
  noun: string;
  onCopy?: () => void;
}) => {
  const [outcome, setOutcome] = useState<CopyOutcome>("Idle");
  const id = useId();
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);
  const select = () => {
    const node = document.getElementById(id);
    const selection = window.getSelection();
    if (node === null || selection === null) return;
    selection.selectAllChildren(node);
  };
  const copy = () =>
    void navigator.clipboard.writeText(text).then(
      () => {
        setOutcome("Copied");
        window.clearTimeout(resetTimer.current);
        resetTimer.current = window.setTimeout(() => setOutcome("Idle"), 2000);
        onCopy?.();
      },
      () => {
        window.clearTimeout(resetTimer.current);
        select();
        setOutcome("Blocked");
        onCopy?.();
      },
    );
  return (
    <div className="grid gap-2">
      <div className="flex flex-col gap-2 rounded-md border bg-muted p-3 sm:flex-row sm:items-start">
        <code id={id} className="min-w-0 flex-1 font-mono text-[13px] break-all whitespace-pre-wrap">
          {text}
        </code>
        <Button variant="outline" size="sm" className="max-sm:h-12 max-sm:w-full" onClick={copy}>
          <CopyIcon aria-hidden />
          {outcome === "Copied" ? "Copied" : label}
        </Button>
      </div>
      <p aria-live="polite" className={cn("text-sm", outcome !== "Blocked" && "sr-only")}>
        {outcome === "Copied" && "Copied"}
        {outcome === "Blocked" && `The browser blocked the copy. The ${noun} is selected; copy it by hand.`}
      </p>
    </div>
  );
};
