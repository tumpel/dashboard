import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

type CopyOutcome = "idle" | "copied" | "failed";

export const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [outcome, setOutcome] = useState<CopyOutcome>("idle");
  const copy = () =>
    void navigator.clipboard.writeText(text).then(
      () => setOutcome("copied"),
      () => setOutcome("failed"),
    );
  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={copy} aria-label={label}>
        <CopyIcon aria-hidden />
        Copy
      </Button>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {outcome === "copied" && "Copied."}
        {outcome === "failed" && "Copy failed: select and copy by hand."}
      </span>
    </span>
  );
};

export const CopyValues = ({ values }: { values: ReadonlyArray<{ name: string; value: string }> }) => (
  <dl className="grid gap-2 text-sm">
    {values.map(({ name, value }) => (
      <div key={name} className="grid gap-1 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
        <dt className="text-muted-foreground">{name}</dt>
        <dd className="min-w-0 font-mono text-[13px] break-all">{value}</dd>
        <dd>
          <CopyButton text={value} label={`Copy ${name.toLowerCase()}`} />
        </dd>
      </div>
    ))}
  </dl>
);
