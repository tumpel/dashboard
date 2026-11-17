import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProblemBlock } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { activeHost } from "../../fleet";
import {
  allDone,
  CHECKED_STEPS,
  type CheckedStep,
  claudeGrant,
  isOpen,
  openSteps,
  readyPersona,
  type SetupReads,
  STEP_LABELS,
} from "../../setup";
import { Rows, Status } from "./parts";
import { StepCard } from "./wizard";

const START_SEARCH = { source: [], persona: [], repo: [], issue: [], model: [], prompt: [] };

const doneValue = (reads: SetupReads, step: CheckedStep): string => {
  if (step === "tenant") return reads.whoami.data?.tenant.name ?? "Done";
  if (step === "github") {
    const github = reads.github.data;
    return github?.connected === true ? github.logins.join(", ") : "Done";
  }
  if (step === "host") {
    const host = activeHost(reads.hosts.data ?? []);
    return host === undefined ? "Done" : `${host.name}, ${host.state}`;
  }
  if (step === "claude") return claudeGrant(reads.grants.data ?? []) === undefined ? "Done" : "Connected";
  const ready = readyPersona(reads.personas.data ?? [], reads.sets.data ?? [], reads.catalog.data ?? [], Date.now());
  return ready.kind === "Ready" ? `${ready.persona.name}, ready` : "Done";
};

const rowValue = (tenantId: string, reads: SetupReads, step: CheckedStep): ReactNode => {
  const state = reads.states[step];
  if (state.kind === "Loading") return <Skeleton className="h-4 w-32" />;
  if (state.kind === "Failed") return <ProblemBlock error={state.error} onRetry={state.retry} />;
  if (state.done) return doneValue(reads, step);
  return (
    <>
      Not done.{" "}
      <Link
        to="/t/$tenantId/setup/$step"
        params={{ tenantId, step }}
        search={{ from: [] }}
        className="underline underline-offset-4"
      >
        Finish
      </Link>
    </>
  );
};

const LEFT_WORDS = [
  "No steps are",
  "One step is",
  "Two steps are",
  "Three steps are",
  "Four steps are",
  "Five steps are",
];

export const DoneStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const left = openSteps(reads.states);
  const all = allDone(reads.states);
  const busy = CHECKED_STEPS.some((step) => reads.states[step].kind === "Loading");
  const footerButton = "max-sm:h-12 max-sm:flex-1";
  return (
    <StepCard
      tenantId={tenantId}
      step="done"
      title={all ? "Your tenant is ready" : "Almost there"}
      done={all}
      busy={busy}
      announce={null}
      footer={
        <>
          {all && (
            <Button variant="outline" className={footerButton} asChild>
              <Link to="/t/$tenantId/sessions/new" params={{ tenantId }} search={START_SEARCH}>
                Start a session
              </Link>
            </Button>
          )}
          <Button className={footerButton} asChild>
            <Link to="/t/$tenantId/overview" params={{ tenantId }}>
              Go to the overview
            </Link>
          </Button>
        </>
      }
    >
      {all && (
        <Status kind="Done" title="All five steps are done">
          Start a session from the overview, or from claude.ai.
        </Status>
      )}
      {left.length > 0 && (
        <Status kind="Waiting" title={`${LEFT_WORDS[left.length] ?? `${left.length} steps are`} left`}>
          The overview shows Resume setup until every step is done.
        </Status>
      )}
      <Rows rows={CHECKED_STEPS.map((step) => [STEP_LABELS[step], rowValue(tenantId, reads, step)] as const)} />
      {isOpen(reads.states.persona) && (
        <p className="text-sm text-muted-foreground">Sessions need step 5: a persona with a Claude token.</p>
      )}
    </StepCard>
  );
};
