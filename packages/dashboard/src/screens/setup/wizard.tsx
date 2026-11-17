import { Link, Navigate, useLocation, useParams } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ApiFailure, type Failure } from "../../api/port";
import { ProblemBlock } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { useDashboard, useSignedOut } from "../../context";
import { cn } from "../../lib";
import {
  allDone,
  CHECKED_STEPS,
  firstOpenStep,
  isDone,
  isOpen,
  SETUP_STEPS,
  type SetupReads,
  type SetupStep,
  STEP_LABELS,
  type StepState,
  useSetupReads,
  useStillLoading,
} from "../../setup";
import { ClaudeStep } from "./claude-step";
import { DoneStep } from "./done-step";
import { GitHubStep } from "./github-step";
import { HostStep } from "./host-step";
import { PersonaStep } from "./persona-step";
import { TenantStep } from "./tenant-step";

const NO_SEARCH = { from: [] };

const stepAfter = (step: SetupStep): SetupStep => SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? "done";
const stepBefore = (step: SetupStep): SetupStep | null => SETUP_STEPS[SETUP_STEPS.indexOf(step) - 1] ?? null;

const stateOf = (reads: SetupReads, step: SetupStep): StepState =>
  step === "done" ? { kind: "Read", done: allDone(reads.states) } : reads.states[step];

const SignedOutBand = () => {
  const { ports } = useDashboard();
  const location = useLocation();
  const [failure, setFailure] = useState<Failure | null>(null);
  return (
    <div role="alert" className="border-b-2 border-destructive bg-card px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">You are signed out of this tenant.</h2>
          <p className="text-sm text-muted-foreground">
            Your sign-in expired or a device was revoked. Nothing below is current.
          </p>
        </div>
        <Button
          className="max-sm:h-12 max-sm:w-full"
          onClick={() => void ports.auth.signIn(location.href).then(setFailure)}
        >
          Sign in again
        </Button>
      </div>
      {failure !== null && <ProblemBlock className="mx-auto mt-3 max-w-3xl" error={new ApiFailure(failure)} />}
    </div>
  );
};

const StepMark = ({ index, state, current }: { index: number; state: StepState; current: boolean }) => {
  if (isDone(state)) {
    return (
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full bg-primary text-primary-foreground",
          current && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
        )}
      >
        <CheckIcon className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full border bg-card text-xs",
        current ? "border-2 border-foreground font-semibold" : "text-muted-foreground",
      )}
    >
      {state.kind === "Loading" ? <Skeleton className="size-3 rounded-full" /> : index + 1}
    </span>
  );
};

const Stepper = ({ tenantId, reads, step }: { tenantId: string; reads: SetupReads; step: SetupStep }) => {
  const currentIndex = SETUP_STEPS.indexOf(step);
  const doneCount = CHECKED_STEPS.filter((each) => isDone(reads.states[each])).length;
  return (
    <nav aria-label="Setup steps" className="mb-5">
      <ol className="hidden grid-cols-6 sm:grid">
        {SETUP_STEPS.map((each, index) => {
          const state = stateOf(reads, each);
          const current = each === step;
          const skipped = index < currentIndex && isOpen(state);
          return (
            <li key={each} className="relative grid justify-items-center">
              {index < SETUP_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3.5 left-[calc(50%+1.25rem)] h-px w-[calc(100%-2.5rem)]",
                    isDone(state) ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <Link
                to="/t/$tenantId/setup/$step"
                params={{ tenantId, step: each }}
                search={NO_SEARCH}
                aria-current={current ? "step" : undefined}
                className="grid justify-items-center gap-1 rounded-md px-1 text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <StepMark index={index} state={state} current={current} />
                <span className={cn(current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {STEP_LABELS[each]}
                  {isDone(state) && <span className="sr-only">, done</span>}
                </span>
                {skipped && <span className="text-[11px] text-muted-foreground">not done</span>}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-2 sm:hidden">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {currentIndex + 1} of {SETUP_STEPS.length}
          </span>
          <span>
            {doneCount} of {CHECKED_STEPS.length} done
          </span>
        </div>
        <ol className="grid grid-cols-6 gap-1">
          {SETUP_STEPS.map((each) => (
            <li key={each}>
              <Link
                to="/t/$tenantId/setup/$step"
                params={{ tenantId, step: each }}
                search={NO_SEARCH}
                aria-label={`${STEP_LABELS[each]}${isDone(stateOf(reads, each)) ? ", done" : ""}`}
                aria-current={each === step ? "step" : undefined}
                className={cn(
                  "block h-2 rounded-sm",
                  isDone(stateOf(reads, each)) ? "bg-primary" : each === step ? "border border-foreground" : "bg-muted",
                )}
              />
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
};

const Frame = ({
  tenantId,
  reads,
  step,
  children,
}: {
  tenantId: string;
  reads: SetupReads;
  step: SetupStep;
  children: ReactNode;
}) => {
  const signedOut = useSignedOut();
  const { ports } = useDashboard();
  const stored = ports.auth.signedInTenants().find((tenant) => tenant.tenantId === tenantId);
  const tenantName = reads.whoami.data?.tenant.name ?? stored?.tenantName ?? tenantId;
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
        <img src="/logo128.png" alt="" width={24} height={24} />
        <span className="font-semibold">Tumpel</span>
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
          Set up <span className="font-semibold text-foreground">{tenantName}</span>
        </span>
        <Link
          to="/t/$tenantId/overview"
          params={{ tenantId }}
          className="ml-auto text-sm text-foreground underline underline-offset-4"
        >
          Exit setup
        </Link>
      </header>
      {signedOut && <SignedOutBand />}
      <main
        inert={signedOut}
        data-inert={signedOut}
        className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-28 data-[inert=true]:opacity-50 sm:pb-10"
      >
        <Stepper tenantId={tenantId} reads={reads} step={step} />
        {children}
      </main>
    </div>
  );
};

export const StepCard = ({
  tenantId,
  step,
  title,
  kicker,
  lead,
  done,
  busy,
  announce,
  footer,
  children,
}: {
  tenantId: string;
  step: SetupStep;
  title: string;
  kicker?: string;
  lead?: string;
  done: boolean;
  busy: boolean;
  announce: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const wasDone = useRef(done);
  const [message, setMessage] = useState("");
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (done && !wasDone.current && announce !== null) setMessage(announce);
    wasDone.current = done;
  }, [done, announce]);
  const back = stepBefore(step);
  const next = stepAfter(step);
  const footerButton = "max-sm:h-12 max-sm:flex-1";
  return (
    <section className="rounded-lg border bg-card">
      <div className="grid gap-4 p-4 sm:p-8" aria-busy={busy}>
        <div className="grid gap-1">
          {kicker !== undefined && <p className="text-xs text-muted-foreground">{kicker}</p>}
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">
            {title}
          </h2>
          {lead !== undefined && <p className="text-muted-foreground">{lead}</p>}
        </div>
        {children}
        <p aria-live="polite" className="sr-only">
          {message}
        </p>
      </div>
      <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t bg-card p-4 sm:static sm:px-8">
        {back !== null && (
          <Button variant="outline" className={cn(footerButton, "max-sm:flex-none max-sm:w-24")} asChild>
            <Link to="/t/$tenantId/setup/$step" params={{ tenantId, step: back }} search={NO_SEARCH}>
              Back
            </Link>
          </Button>
        )}
        <span className="hidden flex-1 sm:block" />
        {footer ?? (
          <Button variant={done ? "default" : "outline"} className={footerButton} asChild>
            <Link to="/t/$tenantId/setup/$step" params={{ tenantId, step: next }} search={NO_SEARCH}>
              {done ? "Next" : "Skip for now"}
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
};

export const StillLoading = ({ pending }: { pending: boolean }) =>
  useStillLoading(pending) ? <p className="text-sm text-muted-foreground">Still loading.</p> : null;

export const StepSkeleton = ({ pending }: { pending: boolean }) => (
  <div className="grid gap-3">
    <Skeleton className="h-4 w-11/12" />
    <Skeleton className="h-4 w-7/12" />
    <Skeleton className="h-4 w-10/12" />
    <Skeleton className="h-10 w-full" />
    <StillLoading pending={pending} />
  </div>
);

const isStep = (value: string): value is SetupStep => SETUP_STEPS.some((step) => step === value);

export const SetupStepScreen = () => {
  const { tenantId, step } = useParams({ from: "/t/$tenantId/setup/$step" });
  const reads = useSetupReads(tenantId);
  if (!isStep(step)) return <Navigate to="/t/$tenantId/setup" params={{ tenantId }} replace />;
  return (
    <Frame tenantId={tenantId} reads={reads} step={step}>
      {step === "tenant" && <TenantStep key={step} tenantId={tenantId} reads={reads} />}
      {step === "github" && <GitHubStep key={step} tenantId={tenantId} reads={reads} />}
      {step === "host" && <HostStep key={step} tenantId={tenantId} reads={reads} />}
      {step === "claude" && <ClaudeStep key={step} tenantId={tenantId} reads={reads} />}
      {step === "persona" && <PersonaStep key={step} tenantId={tenantId} reads={reads} />}
      {step === "done" && <DoneStep key={step} tenantId={tenantId} reads={reads} />}
    </Frame>
  );
};

export const SetupIndexScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/setup/" });
  const reads = useSetupReads(tenantId);
  const loading = CHECKED_STEPS.some((step) => reads.states[step].kind === "Loading");
  if (!loading) {
    return (
      <Navigate
        to="/t/$tenantId/setup/$step"
        params={{ tenantId, step: firstOpenStep(reads.states) }}
        search={NO_SEARCH}
        replace
      />
    );
  }
  return (
    <Frame tenantId={tenantId} reads={reads} step="tenant">
      <section className="rounded-lg border bg-card p-4 sm:p-8" aria-busy>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Setting up</h2>
        <StepSkeleton pending />
      </section>
    </Frame>
  );
};
