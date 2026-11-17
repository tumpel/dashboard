import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { DicesIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import type { HarnessCatalogEntry, ModelProvider, SecretKey, SecretSet, SecretValue } from "../api/port";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { keys, useClaudeSetup, useHarnessCatalog, useSecretSet } from "../queries";
import {
  type CredentialKind,
  catalogKinds,
  catalogProviders,
  catalogVariable,
  replacedBy,
  suggestName,
  withSecret,
} from "../secret-wizard";
import { ClaudeSetupButton, ClaudeSetupPanel } from "./claude-setup";
import { CodexSignIn } from "./codex-sign-in";
import { OpenRouterSection } from "./openrouter-connect";
import { toOffsetIso } from "./secret-set-form";

export const SECRET_CHOICES = ["Plain", "Anthropic", "OpenRouter", "Codex"] as const;
export type SecretChoice = (typeof SECRET_CHOICES)[number];

const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const button = "justify-self-start max-sm:h-12 max-sm:w-full";

const CHOICES: { secret: SecretChoice; title: string; detail: string }[] = [
  { secret: "Plain", title: "API key or token", detail: "Paste a key, a token or any other value." },
  { secret: "Anthropic", title: "Anthropic subscription", detail: "Sign in to Claude to make a Claude Code token." },
  { secret: "OpenRouter", title: "OpenRouter", detail: "Approve on OpenRouter to make an API key." },
  { secret: "Codex", title: "Codex subscription", detail: "Sign in with ChatGPT to connect Codex." },
];

const KIND_LABELS: Record<CredentialKind, string> = { ApiKey: "API key", SubscriptionToken: "Subscription token" };

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  Anthropic: "Anthropic",
  OpenAi: "OpenAI",
  Mistral: "Mistral",
  Google: "Google",
  OpenRouter: "OpenRouter",
};

const StepCount = ({ step }: { step: number }) => <p className="text-sm text-muted-foreground">Step {step} of 3</p>;

const SecretSetsCrumb = ({ tenantId, children }: { tenantId: string; children?: ReactNode }) => (
  <>
    <Link to="/t/$tenantId/secrets" params={{ tenantId }} className="hover:underline">
      Secret sets /
    </Link>
    {children}
  </>
);

export const NewSecretSetScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/secrets/new" });
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const id = useId();
  const [name, setName] = useState(() => suggestName(Math.random));
  const create = useMutation({
    mutationFn: () => api.createSecretSet({ name: name.trim(), secrets: [] }),
    onSuccess: (saved) => {
      queryClient.setQueryData(keys.secretSet(tenantId, saved.secretSetId), saved);
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
      void navigate({
        to: "/t/$tenantId/secrets/$secretSetId/add",
        params: { tenantId, secretSetId: saved.secretSetId },
        search: {},
      });
    },
  });
  const empty = name.trim() === "";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!empty) create.mutate();
  };
  return (
    <>
      <PageHeader title="New secret set" crumb={<SecretSetsCrumb tenantId={tenantId} />} />
      <form className="grid max-w-md gap-4" onSubmit={submit} noValidate autoComplete="off">
        <StepCount step={1} />
        <Field id={id} label="Name" error={null} hint="Type your own, or roll a new suggestion.">
          <div className="flex gap-2">
            <Input
              id={id}
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                create.reset();
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Suggest another name"
              onClick={() => {
                setName(suggestName(Math.random));
                create.reset();
              }}
            >
              <DicesIcon />
            </Button>
          </div>
        </Field>
        {create.isError && <ProblemBlock error={create.error} />}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={empty || create.isPending} aria-busy={create.isPending}>
            {create.isPending ? "Creating..." : "Next"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/t/$tenantId/secrets" params={{ tenantId }}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </>
  );
};

const useAddSecret = (tenantId: string, secretSet: SecretSet) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (added: SecretValue) =>
      api.updateSecretSet(secretSet.secretSetId, { name: secretSet.name, secrets: withSecret(secretSet.keys, added) }),
    onSuccess: (saved, added) => {
      queryClient.setQueryData(keys.secretSet(tenantId, saved.secretSetId), saved);
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
      toast(`${added.name} added to ${saved.name}.`);
      void navigate({ to: "/t/$tenantId/secrets/$secretSetId", params: { tenantId, secretSetId: saved.secretSetId } });
    },
  });
};

const ReplaceNote = ({ secretSet, added }: { secretSet: SecretSet; added: SecretValue | null }) => {
  if (added === null) return null;
  const replaced = replacedBy(secretSet.keys, added);
  if (replaced.length === 0) return null;
  return <p className="text-sm">Replaces {replaced.map((key) => key.name).join(" and ")}.</p>;
};

type Purpose = ModelProvider | "Variable";

const PlainForm = ({
  tenantId,
  secretSet,
  catalog,
}: {
  tenantId: string;
  secretSet: SecretSet;
  catalog: HarnessCatalogEntry[];
}) => {
  const ids = { purpose: useId(), kind: useId(), name: useId(), value: useId(), expires: useId() };
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [kind, setKind] = useState<CredentialKind | null>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState("");
  const save = useAddSecret(tenantId, secretSet);
  const providers = catalogProviders(catalog);
  const kinds = purpose === null || purpose === "Variable" ? [] : catalogKinds(catalog, purpose);
  const choosePurpose = (next: Purpose) => {
    const nextKinds = next === "Variable" ? [] : catalogKinds(catalog, next);
    const [onlyKind] = nextKinds.length === 1 ? nextKinds : [];
    setPurpose(next);
    setKind(onlyKind ?? null);
    setName(next === "Variable" || onlyKind === undefined ? "" : catalogVariable(catalog, next, onlyKind));
    save.reset();
  };
  const chooseKind = (next: CredentialKind) => {
    setKind(next);
    if (purpose !== null && purpose !== "Variable") setName(catalogVariable(catalog, purpose, next));
    save.reset();
  };
  const nameShown = purpose === "Variable" || kind !== null;
  const nameError =
    name !== "" && !NAME_PATTERN.test(name) ? "Capitals, digits and _ only, not starting with a digit." : null;
  const valueShown = nameShown && name !== "" && nameError === null;
  const expiresShown = valueShown && kind === "SubscriptionToken" && value !== "";
  const added = ((): SecretValue | null => {
    if (!valueShown || purpose === null) return null;
    if (purpose === "Variable") return { kind: "Variable", name, value };
    if (kind === "ApiKey") return { kind, name, provider: purpose, value };
    if (kind === "SubscriptionToken") return { kind, name, provider: purpose, value, expiresAt: "" };
    return null;
  })();
  const ready = added !== null && value !== "" && (kind !== "SubscriptionToken" || expires !== "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || added === null) return;
    save.mutate(added.kind === "SubscriptionToken" ? { ...added, expiresAt: toOffsetIso(expires) } : added);
  };
  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate autoComplete="off">
      <Field id={ids.purpose} label="For" error={null} hint={null}>
        <NativeSelect
          id={ids.purpose}
          value={purpose ?? ""}
          autoFocus
          onChange={(event) => {
            const next = [...providers, "Variable" as const].find((item) => item === event.target.value);
            if (next !== undefined) choosePurpose(next);
          }}
        >
          <option value="" disabled>
            Choose a provider
          </option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
          <option value="Variable">Something else</option>
        </NativeSelect>
      </Field>
      {kinds.length > 1 && (
        <Field id={ids.kind} label="Type" error={null} hint={null}>
          <NativeSelect
            id={ids.kind}
            value={kind ?? ""}
            onChange={(event) => {
              const next = kinds.find((item) => item === event.target.value);
              if (next !== undefined) chooseKind(next);
            }}
          >
            <option value="" disabled>
              Choose a type
            </option>
            {kinds.map((item) => (
              <option key={item} value={item}>
                {KIND_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {nameShown && (
        <Field
          id={ids.name}
          label="Variable name"
          error={nameError}
          hint={
            purpose === "Variable" ? "Sessions get the value under this name." : "Filled in from the harness catalog."
          }
        >
          <Input
            id={ids.name}
            className="font-mono"
            value={name}
            placeholder="NAME"
            aria-invalid={nameError !== null}
            autoFocus={purpose === "Variable"}
            onChange={(event) => {
              setName(event.target.value.toUpperCase());
              save.reset();
            }}
          />
        </Field>
      )}
      {valueShown && (
        <Field id={ids.value} label={kind === null ? "Value" : KIND_LABELS[kind]} error={null} hint={null}>
          <Input
            id={ids.value}
            type="password"
            autoComplete="new-password"
            value={value}
            autoFocus={purpose !== "Variable"}
            onChange={(event) => {
              setValue(event.target.value);
              save.reset();
            }}
          />
        </Field>
      )}
      {expiresShown && (
        <Field id={ids.expires} label="Expires" error={null} hint={null}>
          <Input
            id={ids.expires}
            type="datetime-local"
            value={expires}
            onChange={(event) => {
              setExpires(event.target.value);
              save.reset();
            }}
          />
        </Field>
      )}
      <ReplaceNote secretSet={secretSet} added={added} />
      {save.isError && <ProblemBlock error={save.error} />}
      {valueShown && (
        <Button type="submit" className={button} disabled={!ready || save.isPending} aria-busy={save.isPending}>
          {save.isPending ? "Saving..." : "Add secret"}
        </Button>
      )}
    </form>
  );
};

const PlainStep = ({ tenantId, secretSet }: { tenantId: string; secretSet: SecretSet }) => {
  const catalog = useHarnessCatalog(tenantId);
  if (catalog.isPending) return <Skeleton className="h-40 w-full max-w-md" />;
  if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
  return <PlainForm tenantId={tenantId} secretSet={secretSet} catalog={catalog.data} />;
};

const ConnectSection = ({
  label,
  state,
  children,
}: {
  label: string;
  state: "Connected" | "NotConnected" | "SettingUp" | "Failed";
  children: ReactNode;
}) => (
  <section className="grid gap-2 rounded-lg border bg-card p-4" aria-label={label}>
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-semibold">{label}</h2>
      <Badge variant={state === "Connected" ? "success" : state === "Failed" ? "destructive" : "outline"}>
        {state === "NotConnected" ? "Not connected" : state === "SettingUp" ? "Setting up" : state}
      </Badge>
    </div>
    {children}
  </section>
);

const holds = (secretSet: SecretSet, match: (key: SecretKey) => boolean): boolean => secretSet.keys.some(match);

const AnthropicStep = ({ tenantId, secretSet }: { tenantId: string; secretSet: SecretSet }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const flow = useClaudeSetup(tenantId, secretSet.secretSetId);
  const ended = flow.read.data?.status.state;
  const connected = holds(secretSet, (key) => key.kind === "SubscriptionToken" && key.provider === "Anthropic");
  const state =
    ended === "Completed"
      ? "Connected"
      : ended === "Failed"
        ? "Failed"
        : flow.active
          ? "SettingUp"
          : connected
            ? "Connected"
            : "NotConnected";
  return (
    <ConnectSection label="Anthropic subscription" state={state}>
      {flow.active ? (
        <ClaudeSetupPanel
          flow={flow}
          closeLabel="Cancel"
          next={
            <Button
              className={button}
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: keys.secretSet(tenantId, secretSet.secretSetId) });
                void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
                void navigate({
                  to: "/t/$tenantId/secrets/$secretSetId",
                  params: { tenantId, secretSetId: secretSet.secretSetId },
                });
              }}
            >
              Done
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm">
            A short-lived box on one of your hosts runs claude setup-token. You sign in to Claude and paste the code,
            then the token is stored here as CLAUDE_CODE_OAUTH_TOKEN.
          </p>
          <ClaudeSetupButton flow={flow} />
        </>
      )}
    </ConnectSection>
  );
};

const CodexStep = ({ tenantId, secretSet }: { tenantId: string; secretSet: SecretSet }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const flow = useClaudeSetup(tenantId, secretSet.secretSetId, "Codex");
  const ended = flow.read.data?.status.state;
  const connected = holds(secretSet, (key) => key.kind === "CredentialFile" && key.provider === "OpenAi");
  const state =
    ended === "Completed"
      ? "Connected"
      : ended === "Failed"
        ? "Failed"
        : flow.active
          ? "SettingUp"
          : connected
            ? "Connected"
            : "NotConnected";
  return (
    <ConnectSection label="Codex subscription" state={state}>
      <CodexSignIn
        flow={flow}
        next={
          <Button
            className={button}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: keys.secretSet(tenantId, secretSet.secretSetId) });
              void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
              void navigate({
                to: "/t/$tenantId/secrets/$secretSetId",
                params: { tenantId, secretSetId: secretSet.secretSetId },
              });
            }}
          >
            Done
          </Button>
        }
      />
    </ConnectSection>
  );
};

const ChooseStep = ({ tenantId, secretSetId }: { tenantId: string; secretSetId: string }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {CHOICES.map((choice) => (
      <Link
        key={choice.secret}
        to="/t/$tenantId/secrets/$secretSetId/add"
        params={{ tenantId, secretSetId }}
        search={{ secret: choice.secret }}
        className="grid gap-1 rounded-lg border bg-card p-4 hover:border-primary focus-visible:border-primary focus-visible:outline-none"
      >
        <span className="font-semibold">{choice.title}</span>
        <span className="text-sm text-muted-foreground">{choice.detail}</span>
      </Link>
    ))}
  </div>
);

const SecretStep = ({
  tenantId,
  secretSet,
  secret,
}: {
  tenantId: string;
  secretSet: SecretSet;
  secret: SecretChoice;
}) => {
  if (secret === "Plain") return <PlainStep tenantId={tenantId} secretSet={secretSet} />;
  if (secret === "Anthropic") return <AnthropicStep tenantId={tenantId} secretSet={secretSet} />;
  if (secret === "Codex") return <CodexStep tenantId={tenantId} secretSet={secretSet} />;
  return <OpenRouterSection tenantId={tenantId} secretSet={secretSet} openRouterAuthorizationId={null} />;
};

export const AddSecretScreen = () => {
  const { tenantId, secretSetId } = useParams({ from: "/t/$tenantId/secrets/$secretSetId/add" });
  const { secret } = useSearch({ from: "/t/$tenantId/secrets/$secretSetId/add" });
  const secretSet = useSecretSet(tenantId, secretSetId);
  if (secretSet.isPending) {
    return (
      <>
        <PageHeader title="Add a secret" crumb={<SecretSetsCrumb tenantId={tenantId} />} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  if (secretSet.isError) {
    return (
      <>
        <PageHeader title="Add a secret" crumb={<SecretSetsCrumb tenantId={tenantId} />} />
        <ProblemBlock error={secretSet.error} onRetry={() => void secretSet.refetch()} />
      </>
    );
  }
  const set = secretSet.data;
  return (
    <>
      <PageHeader
        title={`Add a secret to ${set.name}`}
        crumb={
          <SecretSetsCrumb tenantId={tenantId}>
            {" "}
            <Link to="/t/$tenantId/secrets/$secretSetId" params={{ tenantId, secretSetId }} className="hover:underline">
              {set.name} /
            </Link>
          </SecretSetsCrumb>
        }
      />
      <div className="grid max-w-2xl gap-4">
        <StepCount step={secret === undefined ? 2 : 3} />
        {secret === undefined ? (
          <ChooseStep tenantId={tenantId} secretSetId={secretSetId} />
        ) : (
          <SecretStep key={secret} tenantId={tenantId} secretSet={set} secret={secret} />
        )}
        <div className="flex flex-wrap gap-2">
          {secret !== undefined && (
            <Button variant="outline" asChild>
              <Link to="/t/$tenantId/secrets/$secretSetId/add" params={{ tenantId, secretSetId }} search={{}}>
                Back
              </Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link to="/t/$tenantId/secrets/$secretSetId" params={{ tenantId, secretSetId }}>
              {set.keys.length === 0 ? "Skip for now" : "Cancel"}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};
