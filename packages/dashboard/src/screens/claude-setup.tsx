import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { type ClaudeSetup, type ClaudeSetupFailureReason, type ClaudeSetupStatus, failureOf } from "../api/port";
import { UNRECOGNISED_LABEL, type Wording } from "../api/wording";
import { Field } from "../components/field";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useClock, useTenantApi } from "../context";
import { expiryDate } from "../fleet";
import { type ClaudeSetupFlow, keys } from "../queries";
import { CopyBlock, Status } from "./setup/parts";

const FAILURES: Record<ClaudeSetupFailureReason, Omit<Wording, "detail">> = {
  Unrecognised: { title: UNRECOGNISED_LABEL, fix: "Start a new setup." },
  SetupUrlMissing: {
    title: "The setup box printed no sign-in URL (SetupUrlMissing)",
    fix: "Check that the host is Online and can fetch the Claude Code image, then start a new setup.",
  },
  CodeRejected: {
    title: "Claude Code refused the code (CodeRejected)",
    fix: "Start a new setup, sign in again and paste the code exactly as the sign-in page shows it.",
  },
  ClaudeCodeExited: {
    title: "Claude Code stopped without a token (ClaudeCodeExited)",
    fix: "Start a new setup. If it stops again, report it with the detail above.",
  },
  SetupTimedOut: {
    title: "The setup ran out of time (SetupTimedOut)",
    fix: "Start a new setup. The secret set is unchanged.",
  },
  TokenNotStored: {
    title: "The token was not stored (TokenNotStored)",
    fix: "Start a new setup. The secret set is unchanged.",
  },
  Superseded: {
    title: "A newer setup replaced this one (Superseded)",
    fix: "Follow the newest setup of this secret set, or start a new one.",
  },
  NoHostOnline: {
    title: "The host had no free box slot (NoHostOnline)",
    fix: "Wait for a session on the host to end, or add a host, then start a new setup.",
  },
  RateLimited: {
    title: "Claude Code is rate limited (RateLimited)",
    fix: "Wait a few minutes, then start a new setup.",
  },
};

const CODEX_FAILURES: Partial<Record<ClaudeSetupFailureReason, Omit<Wording, "detail">>> = {
  SetupUrlMissing: {
    title: "The setup box showed no sign-in code (SetupUrlMissing)",
    fix: "Check that the host is Online and can fetch the Codex image, then start a new sign-in.",
  },
  ClaudeCodeExited: {
    title: "Codex stopped before you signed in (ClaudeCodeExited)",
    fix: "Start a new sign-in and enter the new code. If it stops again, report it with the detail above.",
  },
  SetupTimedOut: {
    title: "The sign-in ran out of time (SetupTimedOut)",
    fix: "Start a new sign-in. The secret set is unchanged.",
  },
};

const failureWording = (harness: ClaudeSetup["harness"], reason: ClaudeSetupFailureReason): Omit<Wording, "detail"> =>
  (harness === "Codex" ? CODEX_FAILURES[reason] : undefined) ?? FAILURES[reason];

const LABELS: Record<ClaudeSetup["harness"], { section: string; saved: string; restart: string }> = {
  Unrecognised: { section: UNRECOGNISED_LABEL, saved: UNRECOGNISED_LABEL, restart: "Start a new setup" },
  ClaudeCode: { section: "Set up Claude Code", saved: "Claude token saved", restart: "Start a new setup" },
  Codex: { section: "Sign in to Codex", saved: "Codex token saved", restart: "Start a new sign-in" },
};

const button = "justify-self-start max-sm:h-12 max-sm:w-full";

const timeLeft = (dueAt: string, now: number): string => {
  const seconds = Math.max(0, Math.floor((Date.parse(dueAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const useNow = (): number => {
  const clock = useClock();
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(clock()), 1000);
    return () => window.clearInterval(timer);
  }, [clock]);
  return now;
};

const CheckAgain = ({ read }: { read: UseQueryResult<ClaudeSetup> }) => (
  <Button
    type="button"
    variant="outline"
    className={button}
    aria-busy={read.isFetching}
    disabled={read.isFetching}
    onClick={() => void read.refetch()}
  >
    {read.isFetching ? "Checking..." : "Check again"}
  </Button>
);

const Countdown = ({
  dueAt,
  read,
  children,
}: {
  dueAt: string;
  read: UseQueryResult<ClaudeSetup>;
  children: (left: string) => ReactNode;
}) => {
  const now = useNow();
  if (Date.parse(dueAt) <= now) {
    return (
      <>
        <p className="text-sm font-semibold">This step ran out of time. Check again to see the setup.</p>
        <CheckAgain read={read} />
      </>
    );
  }
  return <p className="text-sm text-muted-foreground">{children(timeLeft(dueAt, now))}</p>;
};

const CodeForm = ({
  flow,
  setup,
  status,
}: {
  flow: ClaudeSetupFlow;
  setup: ClaudeSetup;
  status: Extract<ClaudeSetupStatus, { state: "AwaitingCode" }>;
}) => {
  const api = useTenantApi(flow.tenantId);
  const queryClient = useQueryClient();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => api.submitClaudeSetupCode(setup.claudeSetupId, field.current?.value.trim() ?? ""),
    onSettled: () => {
      if (field.current !== null) field.current.value = "";
    },
    onSuccess: (next) => queryClient.setQueryData(keys.claudeSetup(flow.tenantId, next.claudeSetupId), next),
  });
  useEffect(() => {
    field.current?.focus();
  }, []);
  const send = (event: FormEvent) => {
    event.preventDefault();
    if ((field.current?.value.trim() ?? "") === "") {
      setError("Paste the code the sign-in page shows.");
      return;
    }
    setError(null);
    submit.mutate();
  };
  const sending = submit.isPending || submit.isSuccess;
  return (
    <>
      <p className="text-sm">Sign in, then paste the code in the field below.</p>
      <CopyBlock text={status.signInUrl} label="Copy URL" noun="sign-in URL" />
      <Button variant="outline" className={button} asChild>
        <a href={status.signInUrl} target="_blank" rel="noreferrer">
          Open the sign-in page
          <ExternalLinkIcon aria-hidden />
        </a>
      </Button>
      <form className="grid gap-3" onSubmit={send} noValidate autoComplete="off">
        {submit.isError && <ProblemBlock error={submit.error} actions={<CheckAgain read={flow.read} />} />}
        <Field id={`${id}-code`} label="Sign-in code" error={error} hint={null}>
          <Input
            ref={field}
            id={`${id}-code`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="max-sm:h-12"
            disabled={sending || submit.isError}
            aria-invalid={error !== null}
            onChange={() => setError(null)}
          />
        </Field>
        <Countdown dueAt={status.codeDueAt} read={flow.read}>
          {(left) => `Paste the code within ${left}.`}
        </Countdown>
        <Button type="submit" className={button} aria-busy={submit.isPending} disabled={sending || submit.isError}>
          {sending ? "Sending..." : "Send code"}
        </Button>
      </form>
    </>
  );
};

const DeviceCode = ({
  read,
  status,
}: {
  read: UseQueryResult<ClaudeSetup>;
  status: Extract<ClaudeSetupStatus, { state: "AwaitingCode" }>;
}) => {
  const [copied, setCopied] = useState<boolean | null>(null);
  const code = status.userCode ?? "";
  const copy = () =>
    void navigator.clipboard.writeText(code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  return (
    <>
      <p className="text-sm">Open this link and sign in with your ChatGPT account.</p>
      <a
        href={status.signInUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 justify-self-start text-sm font-medium break-all underline"
      >
        {status.signInUrl}
        <ExternalLinkIcon className="size-4 shrink-0" aria-hidden />
      </a>
      <p className="text-sm">Then enter this code.</p>
      <div className="flex flex-col gap-2 rounded-md border bg-muted p-4 sm:flex-row sm:items-center">
        <code className="flex-1 font-mono text-3xl font-semibold tracking-widest">{code}</code>
        <Button variant="outline" className="max-sm:h-12 max-sm:w-full" onClick={copy}>
          <CopyIcon aria-hidden />
          {copied === true ? "Copied" : "Copy code"}
        </Button>
      </div>
      <p aria-live="polite" className={copied === false ? "text-sm" : "sr-only"}>
        {copied === true && "Copied"}
        {copied === false && "The browser blocked the copy. Copy the code by hand."}
      </p>
      <Countdown dueAt={status.codeDueAt} read={read}>
        {(left) => `Finish signing in within ${left}.`}
      </Countdown>
    </>
  );
};

const NoHostOnlineActions = ({ tenantId }: { tenantId: string }) => (
  <Button size="sm" variant="outline" asChild>
    <Link to="/t/$tenantId/setup/$step" params={{ tenantId, step: "host" }} search={{ from: [] }}>
      Add a host
    </Link>
  </Button>
);

export const ClaudeSetupButton = ({ flow }: { flow: ClaudeSetupFlow }) => (
  <Button type="button" variant="outline" className={button} onClick={() => flow.start.mutate()}>
    Set up Claude Code
  </Button>
);

export const ClaudeSetupPanel = ({
  flow,
  next,
  closeLabel,
}: {
  flow: ClaudeSetupFlow;
  next: ReactNode;
  closeLabel: string;
}) => {
  const { tenantId, start, read, resume } = flow;
  const restart = () => start.mutate();
  const body = (): ReactNode => {
    if (start.isIdle && read.data === undefined && resume.isError) {
      return (
        <ProblemBlock
          error={resume.error}
          onRetry={() => void resume.refetch()}
          retryLabel="Look for the setup again"
        />
      );
    }
    if (start.isPending) {
      return (
        <Status kind="Waiting" title="Starting a setup box">
          Placing a box on one of your hosts.
        </Status>
      );
    }
    if (start.isError) {
      const failure = failureOf(start.error);
      const noHost = failure.kind === "Problem" && failure.problem.code === "NoHostOnline";
      return (
        <ProblemBlock
          error={start.error}
          onRetry={restart}
          retryLabel="Try again"
          actions={noHost ? <NoHostOnlineActions tenantId={tenantId} /> : undefined}
        />
      );
    }
    if (read.isError && read.data === undefined) {
      return <ProblemBlock error={read.error} onRetry={() => void read.refetch()} retryLabel="Check again" />;
    }
    if (read.data === undefined) {
      return (
        <Status kind="Waiting" title="Starting a setup box">
          Reading the setup.
        </Status>
      );
    }
    const setup = read.data;
    const { status } = setup;
    if (status.state === "Starting" && setup.harness === "Codex") {
      return (
        <>
          <Status kind="Waiting" title="The setup box is booting">
            It runs codex login from your pinned Codex {setup.harnessVersion}. The sign-in link and code show here as
            soon as the box prints them.
          </Status>
          <Countdown dueAt={status.urlDueAt} read={read}>
            {(left) => `The sign-in code shows within ${left}.`}
          </Countdown>
        </>
      );
    }
    if (status.state === "Starting") {
      return (
        <>
          <Status kind="Waiting" title="The setup box is booting">
            It runs claude setup-token from your pinned Claude Code {setup.harnessVersion}. The sign-in link shows here
            as soon as the box prints it.
          </Status>
          <Countdown dueAt={status.urlDueAt} read={read}>
            {(left) => `The sign-in link shows within ${left}.`}
          </Countdown>
        </>
      );
    }
    if (status.state === "AwaitingCode" && setup.harness === "Codex") {
      return <DeviceCode read={read} status={status} />;
    }
    if (status.state === "AwaitingCode") {
      return <CodeForm flow={flow} setup={setup} status={status} />;
    }
    if (status.state === "Minting") {
      return (
        <>
          <Status kind="Waiting" title="Claude Code is making the token">
            The box stores it in the secret set and stops.
          </Status>
          <Countdown dueAt={status.tokenDueAt} read={read}>
            {(left) => `The token is stored within ${left}, or the setup fails.`}
          </Countdown>
        </>
      );
    }
    if (status.state === "Completed") {
      return (
        <>
          <Status kind="Done" title={LABELS[setup.harness].saved}>
            The secret set holds {status.memberName}. It expires {expiryDate(status.expiresAt)}.
          </Status>
          {next}
        </>
      );
    }
    if (status.state === "Unrecognised") return <Status kind="Waiting" title={UNRECOGNISED_LABEL} />;
    const wording = failureWording(setup.harness, status.reason);
    return (
      <ProblemCard
        wording={{ title: wording.title, detail: status.detail, fix: wording.fix }}
        onRetry={restart}
        retryLabel={LABELS[setup.harness].restart}
        actions={status.reason === "NoHostOnline" ? <NoHostOnlineActions tenantId={tenantId} /> : undefined}
      />
    );
  };
  const done = read.data?.status.state === "Completed";
  const labels = LABELS[flow.harness];
  return (
    <section className="grid gap-3" aria-label={labels.section} aria-busy={start.isPending || read.isLoading}>
      {read.isError && read.data !== undefined && (
        <ProblemBlock error={read.error} onRetry={() => void read.refetch()} retryLabel="Check again" />
      )}
      {body()}
      {!done && (
        <Button type="button" variant="link" className="h-auto justify-self-start p-0" onClick={flow.close}>
          {closeLabel}
        </Button>
      )}
      <p aria-live="polite" className="sr-only">
        {done ? labels.saved : ""}
      </p>
    </section>
  );
};
