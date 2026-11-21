import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfigExpiryValueSchema, PersonaFileLimit, TenantConfigSchema } from "@tumpel/schemas";
import { type ChangeEvent, useId, useState } from "react";
import type { ConfigPlan, TenantConfig, TenantConfigApply, TumpelApi } from "../api/port";
import { Field } from "../components/field";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useTenantApi } from "../context";
import { cn } from "../lib";
import { keys } from "../queries";

type Loaded = { kind: "Loaded"; fileName: string; config: TenantConfig };

type Phase = { kind: "Choose" } | { kind: "Invalid"; fileName: string; errors: string[] } | Loaded;

type ApplyFile = TenantConfigApply["files"][number];

const readConfig = (fileName: string, text: string): Phase => {
  const parsed = ((): { ok: true; value: unknown } | { ok: false; error: string } => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  })();
  if (!parsed.ok) return { kind: "Invalid", fileName, errors: [`${fileName} is not JSON: ${parsed.error}`] };
  const checked = TenantConfigSchema.safeParse(parsed.value);
  if (!checked.success) {
    return {
      kind: "Invalid",
      fileName,
      errors: checked.error.issues.map((issue) => `/${issue.path.join("/")}: ${issue.message}`),
    };
  }
  return { kind: "Loaded", fileName, config: checked.data };
};

const unique = (values: string[]): string[] => [...new Set(values)];

const secretEnvs = (config: TenantConfig): string[] =>
  unique(config.secretSets.flatMap((set) => set.secrets.map((secret) => secret.valueFrom.env)));

const expiryEnvs = (config: TenantConfig): string[] =>
  unique(
    config.secretSets.flatMap((set) =>
      set.secrets.flatMap((secret) =>
        secret.kind === "SubscriptionToken" && typeof secret.expiresAt !== "string" ? [secret.expiresAt.env] : [],
      ),
    ),
  );

const fileFroms = (config: TenantConfig): string[] =>
  unique(config.personas.flatMap((persona) => persona.files.map((file) => file.from)));

const digestOf = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)).toHex();

const applyFile = async (api: TumpelApi, from: string, bytes: Uint8Array<ArrayBuffer>): Promise<ApplyFile> => {
  if (bytes.byteLength <= PersonaFileLimit.InlineFileBytes) {
    return { source: "Inline", from, content: bytes.toBase64() };
  }
  const digest = await digestOf(bytes);
  const upload = await api.uploadPersonaFile(digest, bytes.byteLength);
  await api.putPersonaFile(upload, from, bytes);
  return { source: "Stored", from, digest, sizeBytes: bytes.byteLength };
};

const omitted = (plan: ConfigPlan): string[] =>
  plan.changes
    .filter((change) => change.action === "Delete" && change.resource !== "HarnessPin")
    .map((change) => `${change.resource === "Persona" ? "persona" : "secret set"} ${change.name}`);

const PlanList = ({ plan, title }: { plan: ConfigPlan; title: string }) => {
  const deletes = omitted(plan);
  return (
    <div className="grid gap-2 text-sm">
      <h4 className="font-semibold">{title}</h4>
      {deletes.length > 0 && (
        <p className="font-bold">
          The file leaves out {deletes.join(", ")}: applying it deletes {deletes.length === 1 ? "it" : "them"}.
        </p>
      )}
      {plan.changes.length === 0 ? (
        <p className="text-muted-foreground">No changes; the tenant matches the file.</p>
      ) : (
        <ul className="grid gap-1 font-mono text-[13px]">
          {plan.changes.map((change) => (
            <li key={change.description} className={cn(change.action === "Delete" && "font-bold")}>
              {change.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LoadedConfig = ({ tenantId, loaded, onAgain }: { tenantId: string; loaded: Loaded; onAgain: () => void }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const id = useId();
  const { config } = loaded;
  const secrets = secretEnvs(config);
  const expiries = expiryEnvs(config);
  const froms = fileFroms(config);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, Uint8Array<ArrayBuffer>>>({});
  const expiryValues = expiries.flatMap((env) => {
    const parsed = ConfigExpiryValueSchema.shape.expiresAt.safeParse(values[env] ?? "");
    return parsed.success ? [{ env, expiresAt: parsed.data }] : [];
  });
  const missing =
    secrets.filter((env) => (values[env] ?? "") === "").length +
    (expiries.length - expiryValues.length) +
    froms.filter((from) => files[from] === undefined).length;
  const plan = useMutation({
    mutationFn: async () =>
      api.planTenantConfig({
        config,
        expiryValues,
        secretValues: [],
        files: await Promise.all(
          froms.map(async (from) => {
            const bytes = files[from] ?? new Uint8Array();
            return { from, digest: await digestOf(bytes), sizeBytes: bytes.byteLength };
          }),
        ),
      }),
  });
  const apply = useMutation({
    mutationFn: async () =>
      api.applyTenantConfig({
        config,
        expiryValues,
        secretValues: secrets.map((env) => ({ env, value: values[env] ?? "" })),
        files: await Promise.all(froms.map((from) => applyFile(api, from, files[from] ?? new Uint8Array()))),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.personas(tenantId) });
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
    },
  });
  const setValue = (env: string) => (event: ChangeEvent<HTMLInputElement>) => {
    plan.reset();
    setValues((current) => ({ ...current, [env]: event.target.value }));
  };
  const setFile = (from: string) => async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen === undefined) return;
    const bytes = new Uint8Array(await chosen.arrayBuffer());
    plan.reset();
    setFiles((current) => ({ ...current, [from]: bytes }));
  };
  if (apply.isSuccess) {
    return (
      <div className="grid gap-3">
        <PlanList plan={apply.data} title={`Applied ${loaded.fileName}`} />
        <Button size="sm" variant="outline" className="justify-self-start" onClick={onAgain}>
          Choose another file
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm">
        {loaded.fileName} matches the TenantConfig schema. Enter each value it names; values stay in this page and
        travel only in the apply request.
      </p>
      {secrets.map((env) => (
        <Field key={env} id={`${id}-${env}`} label={env} error={null} hint="Secret value, written once">
          <Input
            id={`${id}-${env}`}
            type="password"
            autoComplete="off"
            value={values[env] ?? ""}
            onChange={setValue(env)}
          />
        </Field>
      ))}
      {expiries.map((env) => {
        const typed = values[env] ?? "";
        const bad = typed !== "" && !expiryValues.some((each) => each.env === env);
        return (
          <Field
            key={env}
            id={`${id}-${env}`}
            label={env}
            error={bad ? "Give an ISO 8601 date-time with an offset, such as 2027-01-31T09:00:00+01:00" : null}
            hint="When the subscription token stops working, as an ISO 8601 date-time with an offset"
          >
            <Input id={`${id}-${env}`} aria-invalid={bad} value={typed} onChange={setValue(env)} />
          </Field>
        );
      })}
      {froms.map((from) => (
        <Field
          key={from}
          id={`${id}-${from}`}
          label={`File ${from}`}
          error={null}
          hint="A persona file the config names"
        >
          <Input id={`${id}-${from}`} type="file" onChange={(event) => void setFile(from)(event)} />
        </Field>
      ))}
      {plan.isError && <ProblemBlock error={plan.error} onRetry={() => plan.mutate()} />}
      {plan.isSuccess && <PlanList plan={plan.data} title="The plan" />}
      {apply.isError && (
        <ProblemBlock
          error={apply.error}
          actions={
            <Button size="sm" variant="outline" onClick={onAgain}>
              Choose another file
            </Button>
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {plan.isSuccess ? (
          <Button size="sm" disabled={missing > 0 || apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending ? "Applying..." : "Apply"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={expiries.length !== expiryValues.length || froms.some((from) => files[from] === undefined)}
            onClick={() => plan.mutate()}
          >
            {plan.isPending ? "Planning..." : "Show the plan"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onAgain}>
          Choose another file
        </Button>
        {missing > 0 && <span className="text-sm text-muted-foreground">{missing} still missing</span>}
      </div>
    </div>
  );
};

const ImportConfig = ({ tenantId }: { tenantId: string }) => {
  const [phase, setPhase] = useState<Phase>({ kind: "Choose" });
  const id = useId();
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen === undefined) return;
    setPhase(readConfig(chosen.name, await chosen.text()));
  };
  const again = () => setPhase({ kind: "Choose" });
  if (phase.kind === "Loaded") {
    return <LoadedConfig tenantId={tenantId} loaded={phase} onAgain={again} />;
  }
  if (phase.kind === "Invalid") {
    return (
      <ProblemCard
        className="min-w-0 wrap-anywhere"
        wording={{
          title: `${phase.fileName} is not a tenant config`,
          detail: phase.errors.join("; "),
          fix: "Fix each key named, as tumpel config validate prints them, then choose the file again.",
        }}
        actions={
          <Button size="sm" variant="outline" onClick={again}>
            Choose another file
          </Button>
        }
      />
    );
  }
  return (
    <Field
      id={`${id}-config`}
      label="Tenant config file"
      error={null}
      hint="A tenant config file in JSON, such as tenant.json. It is read in this page."
    >
      <Input id={`${id}-config`} type="file" accept="application/json,.json" onChange={(event) => void choose(event)} />
    </Field>
  );
};

export const ConfigImport = ({ tenantId }: { tenantId: string }) => (
  <Card className="mt-6">
    <CardHeader>
      <CardTitle>Import a tenant config</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Apply a TenantConfig file to create and update personas and secret sets in one plan.
      </p>
      <ImportConfig tenantId={tenantId} />
    </CardContent>
  </Card>
);
