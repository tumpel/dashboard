import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ModelProviderSchema, SecretKindSchema } from "@tumpel/schemas";
import { XIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  ApiFailure,
  type KnownSecretKey,
  type KnownSecretSet,
  type ModelProvider,
  type SecretMemberUpdate,
  type SecretSet,
  type SecretValue,
} from "../api/port";
import { UNRECOGNISED_EDIT } from "../api/wording";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Skeleton } from "../components/ui/skeleton";
import { useUnsavedGuard } from "../components/unsaved-guard";
import { useTenantApi } from "../context";
import { knownSecretSet, SECRET_KIND_NAMES } from "../fleet";
import { cn } from "../lib";
import { keys, useSecretSet } from "../queries";

type TokenValue = Extract<SecretValue, { kind: "SubscriptionToken" | "CredentialFile" }>;

type MemberDraft = { rowId: number; storedName: string } & (
  | Exclude<SecretValue, TokenValue>
  | (Omit<TokenValue, "expiresAt"> & { expires: string })
);

const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const KINDS = SecretKindSchema.options;
const PROVIDERS = ModelProviderSchema.options;

const pad = (value: number): string => String(value).padStart(2, "0");

const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toOffsetIso = (local: string): string => {
  const offset = -new Date(local).getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${local}:00${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
};

const draftOf = (key: KnownSecretKey, rowId: number): MemberDraft => {
  const storedName = key.name;
  if (key.kind === "Variable") return { rowId, storedName, kind: key.kind, name: key.name, value: "" };
  if (key.kind === "ApiKey") {
    return { rowId, storedName, kind: key.kind, name: key.name, provider: key.provider, value: "" };
  }
  return {
    rowId,
    storedName,
    kind: key.kind,
    name: key.name,
    provider: key.provider,
    value: "",
    expires: toLocalInput(key.expiresAt),
  };
};

const withKind = (draft: MemberDraft, kind: SecretValue["kind"]): MemberDraft => {
  const { rowId, storedName, name, value } = draft;
  const provider = draft.kind === "Variable" ? "Anthropic" : draft.provider;
  if (kind === "Variable") return { rowId, storedName, kind, name, value };
  if (kind === "ApiKey") return { rowId, storedName, kind, name, provider, value };
  const expires = "expires" in draft ? draft.expires : "";
  return { rowId, storedName, kind, name, provider, value, expires };
};

const secretValueOf = ({ rowId: _, storedName: __, ...draft }: MemberDraft): SecretValue => {
  if (draft.kind === "Variable" || draft.kind === "ApiKey") return draft;
  const { expires, ...token } = draft;
  return { ...token, expiresAt: toOffsetIso(expires) };
};

const memberUpdateOf = (draft: MemberDraft): SecretMemberUpdate => {
  const { value, ...member } = secretValueOf(draft);
  const kept = value === "" ? {} : { value };
  if (draft.storedName === draft.name) return { ...member, ...kept };
  return { ...member, ...kept, previousName: draft.storedName };
};

const nameError = (draft: MemberDraft, drafts: MemberDraft[]): string | null => {
  if (draft.name === "") return null;
  if (!NAME_PATTERN.test(draft.name)) return "Capitals, digits and _ only, not starting with a digit.";
  if (drafts.filter((other) => other.name === draft.name).length > 1) return `Two secrets are named ${draft.name}.`;
  return null;
};

const clashingProviders = (drafts: MemberDraft[]): Set<ModelProvider> => {
  const seen = new Map<ModelProvider, number>();
  for (const draft of drafts) {
    if (draft.kind !== "Variable") seen.set(draft.provider, (seen.get(draft.provider) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([provider]) => provider));
};

const isConflict = (error: unknown): boolean =>
  error instanceof ApiFailure && error.failure.kind === "Problem" && error.failure.status === 409;

const MemberRow = ({
  draft,
  error,
  clash,
  focusValue,
  onChange,
  onRemove,
}: {
  draft: MemberDraft;
  error: string | null;
  clash: boolean;
  focusValue: boolean;
  onChange: (next: MemberDraft) => void;
  onRemove: () => void;
}) => {
  const ids = { name: useId(), kind: useId(), provider: useId(), value: useId(), expires: useId() };
  const label = draft.name === "" ? "unnamed secret" : draft.name;
  return (
    <div
      className={cn(
        "grid gap-2 rounded-md border bg-card p-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_2.25rem] md:items-start",
        clash && "border-2 border-destructive",
      )}
    >
      <div className="grid gap-1">
        <label htmlFor={ids.name} className="sr-only">
          Name of {label}
        </label>
        <Input
          id={ids.name}
          className="font-mono"
          value={draft.name}
          placeholder="NAME"
          aria-invalid={error !== null}
          onChange={(event) => onChange({ ...draft, name: event.target.value.toUpperCase() })}
        />
        {error !== null && <p className="text-xs font-semibold text-destructive">{error}</p>}
      </div>
      <div className="grid gap-1">
        <label htmlFor={ids.kind} className="sr-only">
          Kind of {label}
        </label>
        <NativeSelect
          id={ids.kind}
          value={draft.kind}
          onChange={(event) => {
            const kind = KINDS.find((item) => item === event.target.value);
            if (kind !== undefined) onChange(withKind(draft, kind));
          }}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SECRET_KIND_NAMES[kind]}
            </option>
          ))}
        </NativeSelect>
        {"expires" in draft && (
          <>
            <label htmlFor={ids.expires} className="text-xs text-muted-foreground">
              Expires
            </label>
            <Input
              id={ids.expires}
              type="datetime-local"
              value={draft.expires}
              aria-invalid={draft.expires === ""}
              onChange={(event) => onChange({ ...draft, expires: event.target.value })}
            />
          </>
        )}
      </div>
      <div>
        <label htmlFor={ids.provider} className="sr-only">
          Provider of {label}
        </label>
        <NativeSelect
          id={ids.provider}
          value={draft.kind === "Variable" ? "" : draft.provider}
          disabled={draft.kind === "Variable"}
          onChange={(event) => {
            const provider = PROVIDERS.find((item) => item === event.target.value);
            if (provider !== undefined && draft.kind !== "Variable") onChange({ ...draft, provider });
          }}
        >
          {draft.kind === "Variable" && <option value="">No provider</option>}
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor={ids.value} className="sr-only">
          Value of {label}
        </label>
        <Input
          id={ids.value}
          type="password"
          autoComplete="new-password"
          autoFocus={focusValue}
          value={draft.value}
          placeholder="Stored. Type to replace it."
          onChange={(event) => onChange({ ...draft, value: event.target.value })}
        />
      </div>
      <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
        <XIcon />
      </Button>
    </div>
  );
};

const SecretSetEditor = ({
  tenantId,
  secretSet,
  replace,
}: {
  tenantId: string;
  secretSet: KnownSecretSet;
  replace: string | undefined;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const nameId = useId();
  const [name, setName] = useState(secretSet.name);
  const [drafts, setDrafts] = useState<MemberDraft[]>(() => secretSet.keys.map(draftOf));
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedGuard(dirty);
  const save = useMutation({
    mutationFn: (): Promise<SecretSet> =>
      api.updateSecretSet(secretSet.secretSetId, { name: name.trim(), secrets: drafts.map(memberUpdateOf) }),
    onSuccess: (saved) => {
      guard.release();
      queryClient.setQueryData(keys.secretSet(tenantId, saved.secretSetId), saved);
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
      toast(`${saved.name} saved.`);
      void navigate({ to: "/t/$tenantId/secrets/$secretSetId", params: { tenantId, secretSetId: saved.secretSetId } });
    },
  });
  const edit = (update: (current: MemberDraft[]) => MemberDraft[]) => {
    setDrafts(update);
    setDirty(true);
    save.reset();
  };
  const clashes = isConflict(save.error) ? clashingProviders(drafts) : new Set<ModelProvider>();
  const errors = drafts.map((draft) => nameError(draft, drafts));
  const unnamed = drafts.filter((draft) => draft.name === "").length;
  const undated = drafts.filter((draft) => "expires" in draft && draft.expires === "");
  const blockers = [
    name.trim() === "" ? "Name the set." : null,
    unnamed > 0 ? "Name every secret." : null,
    errors.some((error) => error !== null) ? "Fix the names marked above." : null,
    undated.length > 0 ? `Set when ${undated.map((draft) => draft.name || "the token").join(", ")} expires.` : null,
  ].filter((item) => item !== null);
  return (
    <div className="grid gap-4">
      <div className="max-w-sm">
        <Field id={nameId} label="Name" error={null} hint={null}>
          <Input
            id={nameId}
            value={name}
            autoFocus={replace === undefined}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
              save.reset();
            }}
          />
        </Field>
      </div>
      <div className="hidden gap-2 px-3 text-xs font-semibold text-muted-foreground md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_2.25rem]">
        <span>Name</span>
        <span>Kind</span>
        <span>Provider</span>
        <span>Value</span>
        <span className="w-9" />
      </div>
      <div className="grid gap-2">
        {drafts.map((draft, index) => (
          <MemberRow
            key={draft.rowId}
            draft={draft}
            error={errors[index] ?? null}
            clash={draft.kind !== "Variable" && clashes.has(draft.provider)}
            focusValue={replace !== undefined && draft.name === replace}
            onChange={(next) => edit((current) => current.map((item) => (item.rowId === draft.rowId ? next : item)))}
            onRemove={() => edit((current) => current.filter((item) => item.rowId !== draft.rowId))}
          />
        ))}
      </div>
      <div>
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/t/$tenantId/secrets/$secretSetId/add"
            params={{ tenantId, secretSetId: secretSet.secretSetId }}
            search={{}}
          >
            Add a secret
          </Link>
        </Button>
      </div>
      {save.isError && <ProblemBlock error={save.error} />}
      {blockers.length > 0 && dirty && (
        <ul className="grid gap-0.5 text-sm text-muted-foreground">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={save.isPending || blockers.length > 0} onClick={() => save.mutate()}>
          {save.isPending ? "Saving..." : "Save"}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/t/$tenantId/secrets/$secretSetId" params={{ tenantId, secretSetId: secretSet.secretSetId }}>
            Cancel
          </Link>
        </Button>
      </div>
      {guard.dialog}
    </div>
  );
};

export const EditSecretSetScreen = () => {
  const { tenantId, secretSetId } = useParams({ from: "/t/$tenantId/secrets/$secretSetId/edit" });
  const { replace } = useSearch({ from: "/t/$tenantId/secrets/$secretSetId/edit" });
  const secretSet = useSecretSet(tenantId, secretSetId);
  const crumb = (
    <Link to="/t/$tenantId/secrets" params={{ tenantId }} className="hover:underline">
      Secret sets /
    </Link>
  );
  if (secretSet.isPending) {
    return (
      <>
        <PageHeader title="Edit secret set" crumb={crumb} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  if (secretSet.isError) {
    return (
      <>
        <PageHeader title="Edit secret set" crumb={crumb} />
        <ProblemBlock error={secretSet.error} onRetry={() => void secretSet.refetch()} />
      </>
    );
  }
  const known = knownSecretSet(secretSet.data);
  return (
    <>
      <PageHeader title={`Edit ${secretSet.data.name}`} crumb={crumb} />
      {known === null ? (
        <ProblemCard wording={UNRECOGNISED_EDIT} />
      ) : (
        <SecretSetEditor
          key={`${known.secretSetId}-${known.updatedAt}`}
          tenantId={tenantId}
          secretSet={known}
          replace={replace[0]}
        />
      )}
    </>
  );
};
