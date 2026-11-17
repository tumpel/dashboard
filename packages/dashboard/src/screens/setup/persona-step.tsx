import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { CredentialProblem } from "@tumpel/api/credentials";
import { type FormEvent, useId, useState } from "react";
import type { Persona, SecretMemberUpdate, SecretSet, SecretValue } from "../../api/port";
import { Field } from "../../components/field";
import { ProblemBlock } from "../../components/problem-block";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useUnsavedGuard } from "../../components/unsaved-guard";
import { useTenantApi } from "../../context";
import { expiryDate, HARNESS_NAMES } from "../../fleet";
import { keys, useClaudeSetup, useHarnessPins } from "../../queries";
import {
  CLAUDE_TOKEN,
  DEFAULT_NAME,
  GITHUB_TOKEN,
  type PersonaReadiness,
  readyPersona,
  type SetupReads,
  STEP_TITLES,
} from "../../setup";
import { ClaudeSetupButton, ClaudeSetupPanel } from "../claude-setup";
import { toOffsetIso } from "../secret-set-form";
import { Rows, Status } from "./parts";
import { StepCard, StepSkeleton } from "./wizard";

const TOKEN_PREFIX = "sk-ant-oat";
const LEAD = "Sessions run as this persona. Tumpel picked its settings. Paste your Claude token to finish.";

const pad = (value: number): string => String(value).padStart(2, "0");

const oneYearFromToday = (): string => {
  const date = new Date();
  return `${date.getFullYear() + 1}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const DoneNext = ({ tenantId }: { tenantId: string }) => {
  const queryClient = useQueryClient();
  return (
    <Button className="justify-self-start max-sm:h-12 max-sm:w-full" asChild>
      <Link
        to="/t/$tenantId/setup/$step"
        params={{ tenantId, step: "done" }}
        search={{ from: [] }}
        onClick={() => void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) })}
      >
        Next
      </Link>
    </Button>
  );
};

const Defaults = ({ tenantId, persona, secretSet }: { tenantId: string; persona: Persona; secretSet: SecretSet }) => {
  const pins = useHarnessPins(tenantId);
  const version = pins.data?.find((pin) => pin.harness === persona.harness)?.harnessVersion;
  return (
    <Rows
      rows={[
        ["Persona", persona.name],
        [
          "Harness",
          version === undefined ? HARNESS_NAMES[persona.harness] : `${HARNESS_NAMES[persona.harness]} ${version}`,
        ],
        ["Model", "Picked by the harness"],
        ["Secret set", secretSet.name],
      ]}
    />
  );
};

const TokenForm = ({
  tenantId,
  persona,
  secretSet,
  askGitHub,
  refused,
}: {
  tenantId: string;
  persona: Persona;
  secretSet: SecretSet;
  askGitHub: boolean;
  refused: CredentialProblem | null;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const flow = useClaudeSetup(tenantId, secretSet.secretSetId);
  const id = useId();
  const [token, setToken] = useState("");
  const [gitHubToken, setGitHubToken] = useState("");
  const [expires, setExpires] = useState(oneYearFromToday);
  const [changing, setChanging] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const secrets: SecretValue[] = [
        {
          kind: "SubscriptionToken",
          name: CLAUDE_TOKEN,
          provider: "Anthropic",
          expiresAt: toOffsetIso(`${expires}T00:00`),
          value: token.trim(),
        },
      ];
      if (askGitHub && gitHubToken.trim() !== "") {
        secrets.push({ kind: "Variable", name: GITHUB_TOKEN, value: gitHubToken.trim() });
      }
      const written = new Set(secrets.map((secret) => secret.name));
      const kept = secretSet.keys
        .filter((key) => !written.has(key.name) && (key.kind === "Variable" || key.provider !== "Anthropic"))
        .map(({ updatedAt: _, ...key }): SecretMemberUpdate => key);
      return api.updateSecretSet(secretSet.secretSetId, { name: secretSet.name, secrets: [...secrets, ...kept] });
    },
    onSuccess: () => {
      guard.release();
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
    },
  });
  const guard = useUnsavedGuard(token !== "" && !save.isSuccess);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim().startsWith(TOKEN_PREFIX)) {
      setTokenError(
        "This is not a Claude Code subscription token. Run claude setup-token and paste the token it prints.",
      );
      return;
    }
    setTokenError(null);
    save.mutate();
  };
  const saving = save.isPending || save.isSuccess;
  if (flow.active) {
    return (
      <div className="grid gap-4">
        <Defaults tenantId={tenantId} persona={persona} secretSet={secretSet} />
        <ClaudeSetupPanel flow={flow} next={<DoneNext tenantId={tenantId} />} closeLabel="Paste a token instead" />
      </div>
    );
  }
  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      {save.isError && <ProblemBlock error={save.error} />}
      <Defaults tenantId={tenantId} persona={persona} secretSet={secretSet} />
      {refused !== null && (
        <p className="text-sm font-semibold">
          {refused.detail}. {refused.fix}.
        </p>
      )}
      <Field
        id={`${id}-token`}
        label="Claude token"
        error={tokenError}
        hint="Run claude setup-token in a terminal and paste the token it prints, or let Set up Claude Code run it on one of your hosts."
      >
        <Input
          id={`${id}-token`}
          type="password"
          autoComplete="off"
          className="max-sm:h-12"
          placeholder={`${TOKEN_PREFIX}...`}
          disabled={saving}
          aria-invalid={tokenError !== null}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setTokenError(null);
          }}
        />
      </Field>
      <ClaudeSetupButton flow={flow} />
      {askGitHub && (
        <>
          <Field
            id={`${id}-github`}
            label="GitHub token (optional)"
            error={null}
            hint="The GitHub App is not installed. Paste a token so sessions can clone private repositories. Leave it empty for public ones."
          >
            <Input
              id={`${id}-github`}
              type="password"
              autoComplete="off"
              className="max-sm:h-12"
              disabled={saving}
              value={gitHubToken}
              onChange={(event) => setGitHubToken(event.target.value)}
            />
          </Field>
          <Link
            to="/t/$tenantId/setup/$step"
            params={{ tenantId, step: "github" }}
            search={{ from: [] }}
            className="justify-self-start text-sm underline underline-offset-4"
          >
            Install the GitHub App instead
          </Link>
        </>
      )}
      {changing ? (
        <Field id={`${id}-expires`} label="Token expires" error={null} hint="The date claude setup-token printed.">
          <Input
            id={`${id}-expires`}
            type="date"
            className="max-sm:h-12 sm:w-48"
            disabled={saving}
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">
          Expires {expires}
          {expires === oneYearFromToday() ? ", one year from today" : ""}.{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            disabled={saving}
            onClick={() => setChanging(true)}
          >
            Change
          </Button>
        </p>
      )}
      <Button
        type="submit"
        className="justify-self-start max-sm:h-12 max-sm:w-full"
        aria-busy={save.isPending}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save persona"}
      </Button>
      {guard.dialog}
    </form>
  );
};

export const PersonaStep = ({ tenantId, reads }: { tenantId: string; reads: SetupReads }) => {
  const { personas, sets, catalog, github } = reads;
  const queries = [personas, sets, catalog];
  const pending = queries.some((query) => query.isPending);
  const failed = queries.find((query) => query.isError);
  const ready: PersonaReadiness =
    personas.isSuccess && sets.isSuccess && catalog.isSuccess
      ? readyPersona(personas.data, sets.data, catalog.data, Date.now())
      : { kind: "Missing" };
  const body = () => {
    if (failed !== undefined) {
      return (
        <ProblemBlock
          error={failed.error}
          onRetry={() => {
            for (const query of queries) if (query.isError) void query.refetch();
          }}
        />
      );
    }
    if (pending || !personas.isSuccess || !sets.isSuccess) return <StepSkeleton pending={pending} />;
    if (ready.kind === "Ready") {
      return (
        <>
          <Status kind="Done" title={`Persona ${ready.persona.name} is ready`}>
            {ready.expiresAt === null
              ? "Its credential is saved."
              : `Claude token saved. It expires ${expiryDate(ready.expiresAt)}.`}
          </Status>
          <Defaults tenantId={tenantId} persona={ready.persona} secretSet={ready.secretSet} />
          <Link
            to="/t/$tenantId/secrets/$secretSetId"
            params={{ tenantId, secretSetId: ready.secretSet.secretSetId }}
            className="text-sm underline underline-offset-4"
          >
            Replace the token on the Secret sets page
          </Link>
        </>
      );
    }
    const persona = personas.data.find((each) => each.name === DEFAULT_NAME) ?? personas.data[0];
    const secretSet =
      persona === undefined ? undefined : sets.data.find((set) => set.secretSetId === persona.secretSetId);
    if (persona === undefined || secretSet === undefined || persona.harness !== "ClaudeCode") {
      return (
        <p className="text-sm">
          Your tenant has no Claude Code persona with a secret set to fill here. Set one up on the{" "}
          <Link to="/t/$tenantId/personas" params={{ tenantId }} className="underline underline-offset-4">
            Personas page
          </Link>
          .
        </p>
      );
    }
    const askGitHub = github.data !== undefined && !github.data.connected;
    const writes = new Set(askGitHub ? [CLAUDE_TOKEN, GITHUB_TOKEN] : [CLAUDE_TOKEN]);
    const others = secretSet.keys.filter((key) => !writes.has(key.name)).map((key) => key.name);
    if (others.length > 0) {
      return <KeepOthers tenantId={tenantId} secretSet={secretSet} others={others} />;
    }
    return (
      <TokenForm
        tenantId={tenantId}
        persona={persona}
        secretSet={secretSet}
        askGitHub={askGitHub}
        refused={
          ready.kind === "Refused" &&
          ready.persona.personaId === persona.personaId &&
          ready.problem.code !== "NoCredential"
            ? ready.problem
            : null
        }
      />
    );
  };
  return (
    <StepCard
      tenantId={tenantId}
      step="persona"
      title={STEP_TITLES.persona}
      lead={ready.kind === "Ready" ? undefined : LEAD}
      done={ready.kind === "Ready"}
      busy={pending}
      announce={ready.kind === "Ready" ? `Persona ${ready.persona.name} is ready` : null}
    >
      {body()}
    </StepCard>
  );
};

const KeepOthers = ({ tenantId, secretSet, others }: { tenantId: string; secretSet: SecretSet; others: string[] }) => {
  const flow = useClaudeSetup(tenantId, secretSet.secretSetId);
  if (flow.active) {
    return <ClaudeSetupPanel flow={flow} next={<DoneNext tenantId={tenantId} />} closeLabel="Paste a token instead" />;
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        The secret set {secretSet.name} also holds {others.join(", ")}. Saving here would remove{" "}
        {others.length === 1 ? "it" : "them"}, so add the Claude token on the{" "}
        <Link
          to="/t/$tenantId/secrets/$secretSetId/edit"
          params={{ tenantId, secretSetId: secretSet.secretSetId }}
          search={{ replace: [CLAUDE_TOKEN] }}
          className="underline underline-offset-4"
        >
          Secret sets page
        </Link>
        .
      </p>
      <p className="text-sm">Set up Claude Code adds the token and keeps the other members.</p>
      <ClaudeSetupButton flow={flow} />
    </div>
  );
};
