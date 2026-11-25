import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { failureOf, type Persona, type TriggerCreate, type TriggerEvent, type TriggerTestResult } from "../api/port";
import { UNRECOGNISED_EDIT } from "../api/wording";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input, Textarea } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Skeleton } from "../components/ui/skeleton";
import { useUnsavedGuard } from "../components/unsaved-guard";
import { useTenantApi } from "../context";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { triggerKeys, useOwner, usePersonas, useRepositories, useTrigger } from "../queries";
import {
  conditionLabel,
  type KnownTrigger,
  knownTrigger,
  PRESETS,
  parsePayload,
  presetOf,
  promptFields,
  TRIGGER_EVENTS,
} from "../triggers";

export const OWNER_ONLY =
  "Only an Owner creates, changes or deletes a trigger. Anyone can test it on a sample payload.";

interface Value {
  key: number;
  text: string;
}

interface Row {
  key: number;
  custom: boolean;
  field: string;
  values: Value[];
}

let lastKey = 0;
const freshKey = (): number => {
  lastKey += 1;
  return lastKey;
};

const freshValue = (text: string): Value => ({ key: freshKey(), text });

const rowsOf = (trigger: KnownTrigger | null): Row[] =>
  (trigger?.source.conditions ?? []).map((condition) => ({
    key: freshKey(),
    custom: presetOf(trigger?.source.event ?? "pull_request", condition.field) === undefined,
    field: condition.field,
    values: condition.values.map(freshValue),
  }));

type RefusedField = "name" | "persona" | "model";

const FIELD_OF_CODE: Record<string, RefusedField> = {
  Conflict: "name",
  NotFound: "persona",
  ModelUnsupported: "model",
};

const refusedField = (error: Error | null): RefusedField | null => {
  if (error === null) return null;
  const failure = failureOf(error);
  return failure.kind === "Problem" ? (FIELD_OF_CODE[failure.problem.code] ?? null) : null;
};

const refusalText = (error: Error | null): string => {
  const failure = failureOf(error);
  return failure.kind === "Problem" ? `${failure.problem.detail} ${failure.problem.fix}` : "";
};

const ConditionRow = ({
  event,
  row,
  suggestions,
  readOnly,
  onChange,
  onRemove,
}: {
  event: TriggerEvent;
  row: Row;
  suggestions: readonly string[];
  readOnly: boolean;
  onChange: (row: Row) => void;
  onRemove: () => void;
}) => {
  const listId = useId();
  const label = row.custom ? "Any field" : conditionLabel(event, row.field);
  return (
    <li className="grid gap-2 rounded-md border bg-card p-2 sm:grid-cols-[12rem_1fr_auto]">
      <div className="grid content-start gap-1" title={row.field}>
        <span className="text-sm font-medium">{label}</span>
        {row.custom ? (
          <Input
            aria-label="Field path"
            placeholder="pull_request.base.ref"
            className="font-mono text-xs"
            value={row.field}
            disabled={readOnly}
            onChange={(change) => onChange({ ...row, field: change.target.value })}
          />
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{row.field}</span>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {row.values.map((value) => (
          <Input
            key={value.key}
            aria-label={`${label} value`}
            className="w-48"
            list={listId}
            value={value.text}
            disabled={readOnly}
            onChange={(change) =>
              onChange({
                ...row,
                values: row.values.map((item) =>
                  item.key === value.key ? { key: item.key, text: change.target.value } : item,
                ),
              })
            }
          />
        ))}
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...row, values: [...row.values, freshValue("")] })}
          >
            <PlusIcon aria-hidden />
            value
          </Button>
        )}
      </div>
      {!readOnly && (
        <Button variant="ghost" size="sm" aria-label={`Remove ${label}`} onClick={onRemove}>
          <XIcon aria-hidden />
        </Button>
      )}
    </li>
  );
};

const TestResult = ({ event, result }: { event: TriggerEvent; result: TriggerTestResult }) => {
  const failing = result.conditions.filter((condition) => !condition.holds).length;
  return (
    <div className="grid gap-3" aria-live="polite">
      <p className="font-medium">
        {result.matched
          ? "Match. A delivery of this payload starts a session."
          : `No match. ${failing} of ${result.conditions.length} conditions ${failing === 1 ? "fails" : "fail"}.`}
      </p>
      <ul className="grid gap-1 text-sm">
        {result.conditions.map((condition) => (
          <li
            key={`${condition.field}=${condition.values.join(",")}`}
            className="grid grid-cols-[1.25rem_8rem_1fr] items-baseline gap-2 sm:grid-cols-[1.25rem_8rem_16rem_1fr]"
          >
            {condition.holds ? (
              <CheckIcon className="size-4 text-success" aria-label="holds" />
            ) : (
              <XIcon className="size-4 text-destructive" aria-label="fails" />
            )}
            <span className="font-medium">{conditionLabel(event, condition.field)}</span>
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{condition.field}</span>
            <span className={cn(!condition.holds && "text-destructive")}>
              {condition.actual.length === 0 ? "This payload has no such field" : condition.actual.join(", ")}
              {!condition.holds && ` · wanted ${condition.values.join(" or ")}`}
            </span>
          </li>
        ))}
      </ul>
      {result.missingFields.map((field) => (
        <p key={field} className="text-sm font-semibold text-destructive">
          A start fails: the payload has no <code>{field}</code>.
        </p>
      ))}
      <div className="grid gap-1">
        <p className="text-sm font-medium">Prompt the session would get</p>
        <pre className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{result.prompt}</pre>
      </div>
    </div>
  );
};

const TestPanel = ({ tenantId, draft }: { tenantId: string; draft: TriggerCreate }) => {
  const api = useTenantApi(tenantId);
  const payloadId = useId();
  const [text, setText] = useState("");
  const parsed = text.trim() === "" ? null : parsePayload(text);
  const test = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.testTrigger({ kind: "Draft", trigger: draft, payload }),
  });
  return (
    <section id="test" className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Test against a sample event</h2>
      <Field
        id={payloadId}
        label="Webhook payload"
        error={parsed?.ok === false ? parsed.reason : null}
        hint="Paste a payload from your repository's recent deliveries on GitHub, under Settings, Webhooks or GitHub Apps. A test starts nothing."
      >
        <Textarea
          id={payloadId}
          className="min-h-40 font-mono text-xs"
          spellCheck={false}
          placeholder={'{ "action": "closed", "pull_request": { "merged": true } }'}
          value={text}
          onChange={(change) => {
            setText(change.target.value);
            test.reset();
          }}
        />
      </Field>
      <div>
        <Button
          variant="outline"
          disabled={parsed?.ok !== true || test.isPending}
          onClick={() => parsed?.ok === true && test.mutate(parsed.payload)}
        >
          {test.isPending ? "Testing..." : "Run test"}
        </Button>
      </div>
      {test.isError && <ProblemBlock error={test.error} />}
      {test.isSuccess && <TestResult event={draft.source.event} result={test.data} />}
    </section>
  );
};

const DeleteTriggerDialog = ({ tenantId, trigger }: { tenantId: string; trigger: KnownTrigger }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialog = useHashDialog();
  const remove = useMutation({
    mutationFn: () => api.deleteTrigger(trigger.triggerId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: triggerKeys.trigger(tenantId, trigger.triggerId) });
      void queryClient.invalidateQueries({ queryKey: triggerKeys.list(tenantId) });
      toast(`${trigger.name} deleted.`);
      void navigate({ to: "/t/$tenantId/triggers", params: { tenantId } });
    },
  });
  return (
    <ConfirmDialog
      open={dialog.isOpen("delete")}
      onClose={dialog.close}
      title={`Delete ${trigger.name}?`}
      description="The trigger stops starting sessions. The sessions it started stay."
      cancelLabel="Cancel"
      confirmLabel="Delete trigger"
      pendingLabel="Deleting..."
      destructive
      confirmDisabled={false}
      mutation={remove}
      refusalActions={null}
      onConfirm={() => remove.mutate()}
    />
  );
};

const TriggerEditor = ({
  tenantId,
  trigger,
  personas,
  repositories,
  readOnly,
}: {
  tenantId: string;
  trigger: KnownTrigger | null;
  personas: Persona[];
  repositories: string[];
  readOnly: boolean;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialog = useHashDialog();
  const ids = { name: useId(), source: useId(), event: useId(), persona: useId(), model: useId(), prompt: useId() };
  const prompt = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(trigger?.name ?? "");
  const [event, setEvent] = useState<TriggerEvent>(trigger?.source.event ?? "pull_request");
  const [rows, setRows] = useState<Row[]>(() => rowsOf(trigger));
  const [personaId, setPersonaId] = useState(trigger?.personaId ?? personas[0]?.personaId ?? "");
  const [model, setModel] = useState(trigger?.model ?? "");
  const [promptText, setPromptText] = useState(trigger?.prompt ?? "");
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedGuard(dirty);

  const draft: TriggerCreate = {
    name: name.trim(),
    source: {
      kind: "GitHub",
      event,
      conditions: rows.map((row) => ({
        field: row.field.trim(),
        values: row.values.map((value) => value.text.trim()).filter((value) => value !== ""),
      })),
    },
    personaId,
    model: model.trim(),
    prompt: promptText,
  };
  const missing = [
    draft.name === "" ? "a name" : null,
    draft.source.conditions.some((condition) => condition.field === "" || condition.values.length === 0)
      ? "a field and a value in every condition"
      : null,
    personaId === "" ? "a persona" : null,
    draft.model === "" ? "a model" : null,
    promptText.trim() === "" ? "a prompt" : null,
  ].filter((item) => item !== null);

  const save = useMutation({
    mutationFn: () => (trigger === null ? api.createTrigger(draft) : api.updateTrigger(trigger.triggerId, draft)),
    onSuccess: (saved) => {
      guard.release();
      queryClient.setQueryData(triggerKeys.trigger(tenantId, saved.triggerId), saved);
      void queryClient.invalidateQueries({ queryKey: triggerKeys.list(tenantId) });
      toast(trigger === null ? `${saved.name} created.` : `${saved.name} saved.`);
      void navigate({ to: "/t/$tenantId/triggers/$triggerId", params: { tenantId, triggerId: saved.triggerId } });
    },
  });
  const edit = (apply: () => void) => {
    apply();
    setDirty(true);
    save.reset();
  };
  const addRow = (field: string, custom: boolean) =>
    edit(() => setRows((current) => [...current, { key: freshKey(), custom, field, values: [freshValue("")] }]));
  const insertField = (field: string) => {
    const area = prompt.current;
    const at = area?.selectionStart ?? promptText.length;
    const end = area?.selectionEnd ?? at;
    edit(() => setPromptText(`${promptText.slice(0, at)}{{${field}}}${promptText.slice(end)}`));
    area?.focus();
  };
  const placed = refusedField(save.error);
  const refusal = (field: RefusedField): string | null => (placed === field ? refusalText(save.error) : null);
  const unused = PRESETS[event].filter((item) => !rows.some((row) => !row.custom && row.field === item.field));

  return (
    <>
      {readOnly && <p className="mb-4 text-sm text-muted-foreground">{OWNER_ONLY}</p>}
      <div className="grid max-w-4xl gap-6">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Field id={ids.name} label="Name" error={refusal("name")} hint="Unique in the tenant, such as agent-review.">
            <Input
              id={ids.name}
              value={name}
              disabled={readOnly}
              onChange={(change) => edit(() => setName(change.target.value))}
            />
          </Field>
          <Field id={ids.source} label="Source" error={null} hint={null}>
            <NativeSelect id={ids.source} value="GitHub" disabled={readOnly}>
              <option value="GitHub">GitHub</option>
            </NativeSelect>
          </Field>
          <Field id={ids.event} label="Event" error={null} hint="The GitHub webhook event to listen to.">
            <NativeSelect
              id={ids.event}
              value={event}
              disabled={readOnly}
              onChange={(change) => {
                const next = TRIGGER_EVENTS.find((item) => item === change.target.value);
                if (next !== undefined) edit(() => setEvent(next));
              }}
            >
              {TRIGGER_EVENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">When all of these hold</legend>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No condition: every {event} event starts a session.</p>
          )}
          <ul className="grid gap-2">
            {rows.map((row) => (
              <ConditionRow
                key={row.key}
                event={event}
                row={row}
                readOnly={readOnly}
                suggestions={
                  row.field === "repository.full_name" ? repositories : (presetOf(event, row.field)?.suggestions ?? [])
                }
                onChange={(next) =>
                  edit(() => setRows((current) => current.map((item) => (item.key === row.key ? next : item))))
                }
                onRemove={() => edit(() => setRows((current) => current.filter((item) => item.key !== row.key)))}
              />
            ))}
          </ul>
          {!readOnly && (
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusIcon aria-hidden />
                    Add condition
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {unused.map((item) => (
                    <DropdownMenuItem key={item.field} title={item.field} onSelect={() => addRow(item.field, false)}>
                      {item.label}
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{item.field}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => addRow("", true)}>Any field…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A condition holds when the payload's value at its field equals one of its values. A field that crosses a
            list, such as pull_request.labels.name, holds when any element matches.
          </p>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-medium">Start a session</legend>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              id={ids.persona}
              label="Persona"
              error={refusal("persona")}
              hint={personas.length === 0 ? "No persona yet. Create one under Personas first." : null}
            >
              <NativeSelect
                id={ids.persona}
                value={personaId}
                disabled={readOnly}
                onChange={(change) => edit(() => setPersonaId(change.target.value))}
              >
                {personas.map((persona) => (
                  <option key={persona.personaId} value={persona.personaId}>
                    {persona.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              id={ids.model}
              label="Model"
              error={refusal("model")}
              hint="A model id the persona's harness runs, such as claude-opus-5-5."
            >
              <Input
                id={ids.model}
                value={model}
                disabled={readOnly}
                onChange={(change) => edit(() => setModel(change.target.value))}
              />
            </Field>
          </div>
          <Field
            id={ids.prompt}
            label="Prompt"
            error={null}
            hint="Each {{field}} is filled from the event. A start whose event lacks one is refused."
          >
            <Textarea
              ref={prompt}
              id={ids.prompt}
              className="min-h-32 font-mono text-[13px]"
              value={promptText}
              disabled={readOnly}
              onChange={(change) => edit(() => setPromptText(change.target.value))}
            />
          </Field>
          {!readOnly && (
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Insert field
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {[...new Set(promptFields(event))].map((field) => (
                    <DropdownMenuItem key={field} className="font-mono text-xs" onSelect={() => insertField(field)}>
                      {field}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </fieldset>

        <div className="grid gap-3">
          {save.isError && placed === null && <ProblemBlock error={save.error} />}
          {missing.length > 0 && dirty && (
            <p className="text-sm text-muted-foreground">
              {trigger === null ? "Create" : "Save"} needs {missing.join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {trigger !== null && !readOnly && (
              <Button variant="destructive" asChild>
                <Link to="." hash="delete">
                  Delete trigger
                </Link>
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" asChild>
              <Link
                to={trigger === null ? "/t/$tenantId/triggers" : "/t/$tenantId/triggers/$triggerId"}
                params={{ tenantId, triggerId: trigger?.triggerId ?? "" }}
              >
                Cancel
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="." hash="test">
                Test
              </Link>
            </Button>
            {!readOnly && (
              <Button disabled={save.isPending || missing.length > 0} onClick={() => save.mutate()}>
                {save.isPending ? "Saving..." : trigger === null ? "Create" : "Save"}
              </Button>
            )}
          </div>
        </div>
        {dialog.isOpen("test") && <TestPanel tenantId={tenantId} draft={draft} />}
      </div>
      {trigger !== null && !readOnly && <DeleteTriggerDialog tenantId={tenantId} trigger={trigger} />}
      {guard.dialog}
    </>
  );
};

const TriggerFrame = ({ tenantId, title, children }: { tenantId: string; title: string; children: ReactNode }) => (
  <>
    <PageHeader
      title={title}
      crumb={
        <Link to="/t/$tenantId/triggers" params={{ tenantId }} className="hover:underline">
          Triggers /
        </Link>
      }
    />
    {children}
  </>
);

const TriggerPage = ({
  tenantId,
  title,
  trigger,
}: {
  tenantId: string;
  title: string;
  trigger: KnownTrigger | null;
}) => {
  const owner = useOwner(tenantId);
  const personas = usePersonas(tenantId);
  const repositories = useRepositories(tenantId);
  const body = (): ReactNode => {
    if (personas.isError) return <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />;
    if (personas.isPending) return <Skeleton className="h-96 w-full" />;
    return (
      <>
        {repositories.isError && (
          <ProblemCard
            className="mb-4"
            wording={{
              title: "Repositories did not load",
              detail: "The Repository condition offers no repositories to pick, so type owner/name instead.",
              fix: "Retry, or check the GitHub connection under Connections.",
            }}
            onRetry={() => void repositories.refetch()}
          />
        )}
        <TriggerEditor
          key={`${trigger?.triggerId ?? "new"}-${trigger?.updatedAt ?? 0}`}
          tenantId={tenantId}
          trigger={trigger}
          personas={personas.data}
          repositories={(repositories.data ?? []).map((repository) => `${repository.owner}/${repository.name}`)}
          readOnly={!owner}
        />
      </>
    );
  };
  return (
    <TriggerFrame tenantId={tenantId} title={trigger?.name ?? title}>
      {body()}
    </TriggerFrame>
  );
};

export const NewTriggerScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/triggers/new" });
  return <TriggerPage tenantId={tenantId} title="New trigger" trigger={null} />;
};

export const EditTriggerScreen = () => {
  const { tenantId, triggerId } = useParams({ from: "/t/$tenantId/triggers/$triggerId/edit" });
  const trigger = useTrigger(tenantId, triggerId);
  if (trigger.isError) {
    return (
      <TriggerFrame tenantId={tenantId} title="Trigger">
        <ProblemBlock error={trigger.error} onRetry={() => void trigger.refetch()} />
      </TriggerFrame>
    );
  }
  if (trigger.isPending) {
    return (
      <TriggerFrame tenantId={tenantId} title="Trigger">
        <Skeleton className="h-96 w-full" />
      </TriggerFrame>
    );
  }
  const known = knownTrigger(trigger.data);
  if (known === null) {
    return (
      <TriggerFrame tenantId={tenantId} title={trigger.data.name}>
        <ProblemCard wording={UNRECOGNISED_EDIT} />
      </TriggerFrame>
    );
  }
  return <TriggerPage tenantId={tenantId} title="Trigger" trigger={known} />;
};
