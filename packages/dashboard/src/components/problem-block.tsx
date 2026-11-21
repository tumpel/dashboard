import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { failureOf } from "../api/port";
import { type Wording, wordingOf } from "../api/wording";
import { useDashboard } from "../context";
import { cn } from "../lib";
import { Button } from "./ui/button";

export const reportLink = (base: string, wording: Wording): string => {
  const body = [
    `What failed: ${wording.title}`,
    `Detail: ${wording.detail}`,
    `Page: ${window.location.pathname}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");
  return `${base}?${new URLSearchParams({ title: `Dashboard: ${wording.title}`, body }).toString()}`;
};

interface ProblemActions {
  onRetry?: () => void;
  retryLabel?: string;
  actions?: ReactNode;
  className?: string;
}

export const ProblemBlock = ({ error, ...rest }: ProblemActions & { error: unknown }) => (
  <ProblemCard wording={wordingOf(failureOf(error))} {...rest} />
);

export const ProblemCard = ({
  wording,
  onRetry,
  retryLabel = "Retry",
  actions,
  className,
}: ProblemActions & { wording: Wording }) => {
  const { ports } = useDashboard();
  return (
    <div
      role="alert"
      className={cn("min-w-0 wrap-anywhere rounded-lg border-2 border-destructive bg-card p-4", className)}
    >
      <div className="flex items-start gap-3">
        <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="grid gap-1">
          <h3 className="font-semibold">{wording.title}</h3>
          <p className="text-sm">{wording.detail}</p>
          <p className="text-sm text-muted-foreground">{wording.fix}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {onRetry !== undefined && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {actions}
            <a
              className="text-sm text-primary underline-offset-4 hover:underline"
              href={reportLink(ports.reportIssueUrl, wording)}
              target="_blank"
              rel="noreferrer"
            >
              Report an issue
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
