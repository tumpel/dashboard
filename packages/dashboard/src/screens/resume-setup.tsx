import { Link } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib";
import { CHECKED_STEPS, isDone, openSteps, STEP_TITLES, useSetupReads } from "../setup";

export const ResumeSetup = ({ tenantId }: { tenantId: string }) => {
  const reads = useSetupReads(tenantId);
  const { states } = reads;
  if (CHECKED_STEPS.some((step) => states[step].kind === "Loading")) return null;
  const failed = CHECKED_STEPS.filter((step) => states[step].kind === "Failed");
  const done = CHECKED_STEPS.filter((step) => isDone(states[step]));
  const left = openSteps(states);
  if (left.length === 0 && failed.length === 0) return null;
  const retry = () => {
    for (const step of failed) {
      const state = states[step];
      if (state.kind === "Failed") state.retry();
    }
  };
  return (
    <Card className="mb-6 border-2 border-primary">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="text-[17px] font-semibold">Finish setting up your tenant</h2>
          <p className="text-sm">
            {done.length} of {CHECKED_STEPS.length} done.
            {left.length > 0 && ` Left: ${left.map((step) => STEP_TITLES[step]).join(", ")}.`}
          </p>
          {failed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {failed.length === 1 ? "One step" : `${failed.length} steps`} did not load.{" "}
              <Button variant="link" className="h-auto p-0" onClick={retry}>
                Retry
              </Button>
            </p>
          )}
          <ol className="mt-1 grid max-w-xs grid-cols-5 gap-1" aria-hidden>
            {CHECKED_STEPS.map((step) => (
              <li key={step} className={cn("h-2 rounded-sm", isDone(states[step]) ? "bg-primary" : "bg-muted")} />
            ))}
          </ol>
        </div>
        <Button className="max-sm:h-12" asChild>
          <Link to="/t/$tenantId/setup" params={{ tenantId }}>
            Resume setup
          </Link>
        </Button>
      </div>
    </Card>
  );
};
