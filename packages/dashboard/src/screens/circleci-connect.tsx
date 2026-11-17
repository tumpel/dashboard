import { useMutation } from "@tanstack/react-query";
import { CircleCIConnectionStartSchema } from "@tumpel/schemas";
import { ExternalLinkIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import type {
  CircleCIAuthorization,
  CircleCIAuthorizationFailureReason,
  CircleCIAuthorizationStatus,
} from "../api/port";
import type { Wording } from "../api/wording";
import { Field } from "../components/field";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { useClock, useTenantApi } from "../context";
import { expiryDate } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { fieldErrors, useRefreshConnections } from "./connection-dialogs";
import { Status } from "./setup/parts";

const FAILURES: Record<CircleCIAuthorizationFailureReason, Omit<Wording, "detail">> = {
  AuthorizationTimedOut: {
    title: "The authorization ran out of time (AuthorizationTimedOut)",
    fix: "Start again and paste the address within 10 minutes.",
  },
  AccessDenied: {
    title: "CircleCI did not grant access (AccessDenied)",
    fix: "Start again and choose Allow on CircleCI's page.",
  },
  CodeRefused: {
    title: "CircleCI refused the code (CodeRefused)",
    fix: "Start again and paste the address straight after choosing Allow.",
  },
  NoOrganization: {
    title: "The token reads no CircleCI organization (NoOrganization)",
    fix: "Join an organization on CircleCI, or authorize it in the SSO section of CircleCI's page, then start again.",
  },
  ExchangeFailed: {
    title: "CircleCI did not finish the connection (ExchangeFailed)",
    fix: "Start again once https://status.circleci.com is green.",
  },
};

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

const Countdown = ({
  dueAt,
  restart,
  children,
}: {
  dueAt: string;
  restart: () => void;
  children: (left: string) => ReactNode;
}) => {
  const now = useNow();
  if (Date.parse(dueAt) <= now) {
    return (
      <ProblemCard
        wording={{
          title: FAILURES.AuthorizationTimedOut.title,
          detail: `This step had to finish by ${dueAt}.`,
          fix: FAILURES.AuthorizationTimedOut.fix,
        }}
        onRetry={restart}
        retryLabel="Start again"
      />
    );
  }
  return <p className="text-sm text-muted-foreground">{children(timeLeft(dueAt, now))}</p>;
};

const PasteBack = ({
  status,
  sending,
  error,
  restart,
  send,
}: {
  status: Extract<CircleCIAuthorizationStatus, { state: "AwaitingRedirect" }>;
  sending: boolean;
  error: ReactNode;
  restart: () => void;
  send: (redirectedUrl: string) => void;
}) => {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [missing, setMissing] = useState<string | null>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = field.current?.value.trim() ?? "";
    if (value === "") {
      setMissing("Paste the address the browser shows after you choose Allow.");
      return;
    }
    setMissing(null);
    send(value);
  };
  return (
    <form className="grid gap-3" onSubmit={submit} noValidate autoComplete="off">
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        <li>On CircleCI's page, choose Write or Admin, then Allow.</li>
        <li>
          The browser then opens {status.redirectUri} and shows that it cannot connect. That is expected: nothing runs
          there.
        </li>
        <li>Copy the whole address from the address bar and paste it below.</li>
      </ol>
      <Button variant="outline" size="sm" className="justify-self-start" asChild>
        <a href={status.authorizeUrl} target="_blank" rel="noreferrer">
          Open CircleCI again
          <ExternalLinkIcon aria-hidden />
        </a>
      </Button>
      {error}
      <Field id={`${id}-address`} label="Address the browser landed on" error={missing} hint={null}>
        <Input
          ref={field}
          id={`${id}-address`}
          spellCheck={false}
          placeholder={`${status.redirectUri}?code=...&state=...`}
          disabled={sending}
          aria-invalid={missing !== null}
          onChange={() => setMissing(null)}
        />
      </Field>
      <Countdown dueAt={status.redirectDueAt} restart={restart}>
        {(left) => `Paste the address within ${left}.`}
      </Countdown>
      <Button type="submit" className="justify-self-start" aria-busy={sending} disabled={sending}>
        {sending ? "Connecting..." : "Connect"}
      </Button>
    </form>
  );
};

const ChooseOrganization = ({
  status,
  sending,
  error,
  restart,
  send,
}: {
  status: Extract<CircleCIAuthorizationStatus, { state: "ChoosingOrganization" }>;
  sending: boolean;
  error: ReactNode;
  restart: () => void;
  send: (organizationId: string) => void;
}) => {
  const [chosen, setChosen] = useState(status.organizations[0]?.organizationId ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(chosen);
  };
  return (
    <form className="grid gap-3" onSubmit={submit}>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm">
          Your CircleCI token reads several organizations. Which one bills the builds?
        </legend>
        {status.organizations.map((organization) => (
          <label key={organization.organizationId} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="radio"
              name="circleci-organization"
              value={organization.organizationId}
              checked={chosen === organization.organizationId}
              onChange={() => setChosen(organization.organizationId)}
            />
            <span className="font-medium">{organization.name}</span>
            <span className="text-muted-foreground">{organization.slug}</span>
          </label>
        ))}
      </fieldset>
      {error}
      <Countdown dueAt={status.chooseDueAt} restart={restart}>
        {(left) => `Choose within ${left}.`}
      </Countdown>
      <Button type="submit" className="justify-self-start" aria-busy={sending} disabled={sending || chosen === ""}>
        {sending ? "Connecting..." : "Connect"}
      </Button>
    </form>
  );
};

const CircleCIAuthorizeFlow = ({ tenantId, done }: { tenantId: string; done: () => void }) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnections(tenantId);
  const [authorization, setAuthorization] = useState<CircleCIAuthorization | null>(null);
  const settle = (next: CircleCIAuthorization) => {
    setAuthorization(next);
    if (next.status.state !== "Completed") return;
    refresh();
    toast(
      `CircleCI connected: ${next.status.accountLabel}, until ${expiryDate(next.status.expiresAt)}. Bind each repository with tumpel circleci project add.`,
    );
    done();
  };
  const authorize = useMutation({ mutationFn: () => api.authorizeCircleCIConnection() });
  const complete = useMutation({
    mutationFn: (redirectedUrl: string) =>
      api.completeCircleCIConnection({
        circleCIAuthorizationId: authorization?.circleCIAuthorizationId ?? "",
        redirectedUrl,
      }),
    onSuccess: settle,
  });
  const choose = useMutation({
    mutationFn: (organizationId: string) =>
      api.chooseCircleCIOrganization({
        circleCIAuthorizationId: authorization?.circleCIAuthorizationId ?? "",
        organizationId,
      }),
    onSuccess: settle,
  });
  const start = () => {
    complete.reset();
    choose.reset();
    setAuthorization(null);
    const tab = window.open("", "_blank");
    if (tab !== null) tab.opener = null;
    authorize.mutate(undefined, {
      onSuccess: (started) => {
        if (tab !== null && started.status.state === "AwaitingRedirect")
          tab.location.href = started.status.authorizeUrl;
        settle(started);
      },
      onError: () => tab?.close(),
    });
  };
  if (authorize.isPending) {
    return (
      <Status kind="Waiting" title="Opening CircleCI">
        Registering Tumpel with CircleCI and opening its consent page in a new tab.
      </Status>
    );
  }
  if (authorize.isError) return <ProblemBlock error={authorize.error} onRetry={start} retryLabel="Try again" />;
  if (authorization === null) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          CircleCI asks which access to grant. Tumpel then reads your organization and keeps the token sealed. It lasts
          90 days; the Connections page warns two weeks before it ends.
        </p>
        <Button className="justify-self-start" onClick={start}>
          Continue to CircleCI
          <ExternalLinkIcon aria-hidden />
        </Button>
      </div>
    );
  }
  const { status } = authorization;
  if (status.state === "AwaitingRedirect") {
    return (
      <PasteBack
        status={status}
        sending={complete.isPending}
        error={complete.isError ? <ProblemBlock error={complete.error} /> : null}
        restart={start}
        send={(redirectedUrl) => complete.mutate(redirectedUrl)}
      />
    );
  }
  if (status.state === "ChoosingOrganization") {
    return (
      <ChooseOrganization
        status={status}
        sending={choose.isPending}
        error={choose.isError ? <ProblemBlock error={choose.error} /> : null}
        restart={start}
        send={(organizationId) => choose.mutate(organizationId)}
      />
    );
  }
  if (status.state === "Completed") {
    return (
      <Status kind="Done" title={`CircleCI connected: ${status.accountLabel}`}>
        The token works until {expiryDate(status.expiresAt)}.
      </Status>
    );
  }
  const wording = FAILURES[status.reason];
  return (
    <ProblemCard
      wording={{ title: wording.title, detail: status.detail, fix: wording.fix }}
      onRetry={start}
      retryLabel="Start again"
    />
  );
};

const CircleCITokenForm = ({ tenantId, done }: { tenantId: string; done: () => void }) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnections(tenantId);
  const [organizationId, setOrganizationId] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const connect = useMutation({
    mutationFn: (body: z.infer<typeof CircleCIConnectionStartSchema>) => api.startCircleCIConnection(body),
    onSuccess: (_, body) => {
      refresh();
      setApiToken("");
      toast(
        `CircleCI connected. It bills ${body.accountLabel}. Bind each repository with tumpel circleci project add.`,
      );
      done();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = CircleCIConnectionStartSchema.safeParse({ accountLabel, organizationId, apiToken });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors(new Map());
    connect.mutate(parsed.data);
  };
  const organizationError = errors.get("organizationId") ?? null;
  const accountError = errors.get("accountLabel") ?? null;
  const tokenError = errors.get("apiToken") ?? null;
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <Field
        id="circleci-organization"
        label="CircleCI organization id"
        error={organizationError}
        hint="Organization Settings > Overview shows it, a UUID."
      >
        <Input
          id="circleci-organization"
          value={organizationId}
          aria-invalid={organizationError !== null}
          onChange={(event) => setOrganizationId(event.target.value.trim())}
        />
      </Field>
      <Field
        id="circleci-account"
        label="Billing account"
        error={accountError}
        hint="The CircleCI organization that bills the builds, as you want it shown."
      >
        <Input
          id="circleci-account"
          value={accountLabel}
          aria-invalid={accountError !== null}
          onChange={(event) => setAccountLabel(event.target.value)}
        />
      </Field>
      <Field
        id="circleci-token"
        label="Personal API token"
        error={tokenError}
        hint="User Settings > Personal API Tokens. CircleCI's API refuses project tokens."
      >
        <Input
          id="circleci-token"
          type="password"
          autoComplete="off"
          value={apiToken}
          aria-invalid={tokenError !== null}
          onChange={(event) => setApiToken(event.target.value)}
        />
      </Field>
      {connect.isError && <ProblemBlock error={connect.error} />}
      <DialogFooter>
        <Button type="submit" disabled={connect.isPending}>
          {connect.isPending ? "Connecting..." : "Connect with token"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export const CircleCIConnectDialog = ({ tenantId }: { tenantId: string }) => {
  const dialog = useHashDialog();
  const [pasting, setPasting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dismiss = () => {
    setPasting(false);
    setAttempt((count) => count + 1);
    dialog.close();
  };
  return (
    <Dialog open={dialog.isOpen("connect-circleci")} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-2xl">
        <div className="grid gap-4">
          <DialogTitle>Connect CircleCI</DialogTitle>
          <DialogDescription>
            {pasting
              ? "Tumpel checks the token with CircleCI, stores it sealed and never shows it again."
              : "Connect through CircleCI's consent page. No token to copy and no organization id to look up."}
          </DialogDescription>
          {pasting ? (
            <CircleCITokenForm key={attempt} tenantId={tenantId} done={dismiss} />
          ) : (
            <CircleCIAuthorizeFlow key={attempt} tenantId={tenantId} done={dismiss} />
          )}
          <Button
            type="button"
            variant="link"
            className="h-auto justify-self-start p-0"
            onClick={() => setPasting((now) => !now)}
          >
            {pasting ? "Connect through CircleCI instead" : "Paste a personal API token instead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
