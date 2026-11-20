import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { SessionStartFromIssueSchema } from "@tumpel/schemas";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { z } from "zod";
import {
  ApiFailure,
  failureOf,
  type GitHubIssue,
  type GitHubRepositoryPath,
  type Persona,
  type Problem,
  type SessionStart,
  type SessionStartFromIssue,
  type StartedSession,
} from "../api/port";
import { Combobox, type ComboboxView } from "../components/combobox";
import { EmptyState } from "../components/empty-state";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { RepositoryPicker, useRepositoryListing } from "../components/repository-picker";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, NativeSelect, Textarea } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { HARNESS_NAMES } from "../fleet";
import { cn } from "../lib";
import { keys, useIssues, usePersonas } from "../queries";
import {
  fullName,
  htmlUrlOf,
  pathOf,
  type RepositoryChoice,
  repositoryChoiceOf,
  typedPathOf,
} from "../repository-picker";

const ROUTE = "/t/$tenantId/sessions/new";

export const START_SOURCES = ["prompt", "issue"] as const;
export type StartSource = (typeof START_SOURCES)[number];

const POOL_CODES: ReadonlySet<Problem["code"]> = new Set(["PoolExhausted", "NoHostAvailable", "HostOffline"]);
const ISSUE_CODES: ReadonlySet<Problem["code"]> = new Set(["IssueNotOpen", "IssueNotFound"]);

const IssueNumberSchema = z.coerce.number().pipe(SessionStartFromIssueSchema.shape.issueNumber);

const repositoryPathOf = (value: string | undefined): GitHubRepositoryPath | null =>
  value === undefined ? null : typedPathOf(value);

const issueNumberOf = (value: string | undefined): number | null => {
  const result = IssueNumberSchema.safeParse(value);
  return result.success ? result.data : null;
};

const problemCode = (error: unknown): Problem["code"] | null => {
  if (!(error instanceof ApiFailure) || error.failure.kind !== "Problem") return null;
  return error.failure.problem.code;
};

const SourceTabs = ({ source, onPick }: { source: StartSource; onPick: (source: StartSource) => void }) => (
  <div role="tablist" aria-label="Start from" className="mb-5 flex gap-1 border-b">
    {(
      [
        ["issue", "From an issue"],
        ["prompt", "Write a prompt"],
      ] as const
    ).map(([value, label]) => (
      <button
        key={value}
        type="button"
        role="tab"
        aria-selected={source === value}
        onClick={() => onPick(value)}
        className={cn(
          "-mb-px border-b-2 px-3 py-2 text-sm",
          source === value ? "border-primary font-semibold" : "border-transparent text-muted-foreground",
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

const personaHint = (persona: Persona | undefined): string =>
  persona === undefined
    ? "Pick the persona whose harness, files and secret set the session runs."
    : `Runs ${HARNESS_NAMES[persona.harness]} at the pinned version.`;

const PersonaField = ({
  personas,
  personaId,
  onChange,
}: {
  personas: Persona[];
  personaId: string;
  onChange: (personaId: string) => void;
}) => {
  const id = useId();
  return (
    <Field
      id={id}
      label="Persona"
      error={null}
      hint={personaHint(personas.find((persona) => persona.personaId === personaId))}
    >
      <NativeSelect id={id} value={personaId} onChange={(event) => onChange(event.target.value)}>
        {personas.map((persona) => (
          <option key={persona.personaId} value={persona.personaId}>
            {persona.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
};

const ModelField = ({ id, model, onChange }: { id: string; model: string; onChange: (model: string) => void }) => (
  <Field id={id} label="Model" error={null} hint="The model id the harness runs, such as claude-sonnet-5-5.">
    <Input id={id} value={model} onChange={(event) => onChange(event.target.value)} />
  </Field>
);

const useStart = <B,>(tenantId: string, send: (body: B) => Promise<StartedSession>) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: ROUTE });
  return useMutation({
    mutationFn: send,
    onSuccess: (started) => {
      queryClient.setQueryData(keys.session(tenantId, started.session.sessionId), started.session);
      queryClient.setQueryData(keys.turns(tenantId, started.session.sessionId), [started.turn]);
      void queryClient.invalidateQueries({ queryKey: keys.sessions(tenantId), exact: true });
      void navigate({
        to: "/t/$tenantId/sessions/$sessionId/turns/$turnId",
        params: { tenantId, sessionId: started.session.sessionId, turnId: started.turn.turnId },
        search: { compact: [], tab: [] },
      });
    },
  });
};

const SessionsLink = ({ tenantId, label }: { tenantId: string; label: string }) => (
  <Button size="sm" variant="outline" asChild>
    <Link to="/t/$tenantId/sessions" params={{ tenantId }} search={{ state: [], hostId: [], trigger: [] }}>
      {label}
    </Link>
  </Button>
);

const StartRefusal = ({ tenantId, error }: { tenantId: string; error: unknown }) => {
  const failure = failureOf(error);
  const unreachable = failure.kind === "Unreachable";
  const pool = failure.kind === "Problem" && POOL_CODES.has(failure.problem.code);
  return (
    <>
      <ProblemBlock
        error={error}
        actions={
          unreachable || pool ? (
            <>
              <SessionsLink tenantId={tenantId} label="Open Sessions" />
              {pool && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/t/$tenantId/hosts" params={{ tenantId }} search={{ state: [] }}>
                    Open Hosts
                  </Link>
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {unreachable && (
        <p className="text-sm font-medium">
          The start may have gone through. Open Sessions to check before starting again.
        </p>
      )}
    </>
  );
};

const SubmitRow = ({ tenantId, pending, ready }: { tenantId: string; pending: boolean; ready: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={!ready || pending}>
        {pending ? "Starting..." : "Start session"}
      </Button>
      {pending && (
        <span role="status" className="text-sm text-muted-foreground">
          Waiting for the session, its first turn and its host
        </span>
      )}
    </div>
    {!pending && (
      <Button variant="outline" asChild>
        <Link to="/t/$tenantId/sessions" params={{ tenantId }} search={{ state: [], hostId: [], trigger: [] }}>
          Cancel
        </Link>
      </Button>
    )}
  </div>
);

const submitOnCtrlEnter = (ready: boolean) => (event: KeyboardEvent<HTMLFormElement>) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && ready) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
};

const IssueRow = ({ issue }: { issue: GitHubIssue }) => (
  <span className="grid w-full gap-1 py-2">
    <span className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate">
        <span className="font-medium">#{issue.issueNumber}</span> {issue.title}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{issue.updatedAt.slice(0, 10)}</span>
    </span>
    {issue.labels.length > 0 && (
      <span className="flex flex-wrap gap-1">
        {issue.labels.map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </span>
    )}
  </span>
);

const issueError = (error: unknown): string | null => {
  if (!(error instanceof ApiFailure) || error.failure.kind !== "Problem") return null;
  const { problem } = error.failure;
  if (!ISSUE_CODES.has(problem.code)) return null;
  return `${problem.title}: ${problem.detail}. Pick an open issue.`;
};

const useRepositorySearch = (tenantId: string, acceptsTyped: boolean, reset: () => void) => {
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const target = repositoryPathOf(search.repo[0]);
  const { listing } = useRepositoryListing(tenantId);
  const pick = (choice: RepositoryChoice) => {
    reset();
    void navigate({
      search: (current) => ({ ...current, repo: [fullName(pathOf(choice))], issue: [] }),
      replace: true,
    });
  };
  return { target, listing, choice: repositoryChoiceOf(listing, target, acceptsTyped), pick };
};

const IssueForm = ({
  tenantId,
  personas,
  onWritePrompt,
}: {
  tenantId: string;
  personas: Persona[];
  onWritePrompt: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const repositoryId = useId();
  const issueId = useId();
  const modelId = useId();
  const personaId = search.persona[0] ?? personas[0]?.personaId ?? "";
  const model = search.model[0] ?? "";
  const issueNumber = issueNumberOf(search.issue[0]);
  const start = useStart(tenantId, (body: SessionStartFromIssue) => api.startSessionFromIssue(body));
  const { target, listing, pick } = useRepositorySearch(tenantId, false, () => start.reset());
  const issues = useIssues(tenantId, target);
  const issue = issues.data?.find((item) => item.issueNumber === issueNumber) ?? null;
  const notConnected = listing.state === "NotConfigured" || listing.state === "NotConnected";
  const fieldError = start.isError ? issueError(start.error) : null;
  const set = (field: "persona" | "model", value: string) => {
    start.reset();
    void navigate({ search: (current) => ({ ...current, [field]: value === "" ? [] : [value] }), replace: true });
  };
  const pickIssue = (picked: GitHubIssue) => {
    start.reset();
    void navigate({
      search: (current) => ({ ...current, issue: [String(picked.issueNumber)] }),
      replace: true,
    });
  };
  const ready = personaId !== "" && target !== null && issueNumber !== null && model.trim() !== "" && !notConnected;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (target === null || issueNumber === null) return;
    start.mutate(
      { personaId, owner: target.owner, name: target.name, issueNumber, model: model.trim() },
      {
        onError: (error) => {
          const code = problemCode(error);
          if (code !== null && ISSUE_CODES.has(code) && target !== null) {
            void queryClient.invalidateQueries({ queryKey: keys.issues(tenantId, target.owner, target.name) });
          }
        },
      },
    );
  };
  const emptyIssues =
    target === null ? null : (
      <div className="grid gap-2 px-2 py-3 text-sm">
        <p className="font-semibold">No open issues in {fullName(target)}</p>
        <p className="text-muted-foreground">Write a prompt to start a session on this repository instead.</p>
        <div>
          <Button size="sm" variant="outline" onClick={onWritePrompt}>
            Write a prompt
          </Button>
        </div>
      </div>
    );
  const issueView = (text: string): ComboboxView<GitHubIssue> => {
    const needle = text.trim().toLowerCase();
    const listed = issues.data ?? [];
    const shown = listed.filter((item) =>
      `#${item.issueNumber} ${item.title} ${item.labels.join(" ")}`.toLowerCase().includes(needle),
    );
    const message = () => {
      if (issues.isError) return null;
      if (listed.length === 0) return emptyIssues;
      if (shown.length === 0)
        return <p className="px-2 py-3 text-sm text-muted-foreground">No open issue matches "{text.trim()}".</p>;
      return null;
    };
    return {
      notice: issues.isError ? (
        <ProblemBlock error={issues.error} onRetry={() => void issues.refetch()} className="border" />
      ) : null,
      focus: "Search",
      loading: issues.isPending && target !== null,
      loadingLabel: "Loading the open issues",
      message: message(),
      liveText: `${shown.length} of ${listed.length} open issues`,
      groups: [
        {
          key: "issues",
          heading: null,
          divided: false,
          rows: shown.map((item) => ({
            key: String(item.issueNumber),
            option: item,
            content: <IssueRow issue={item} />,
          })),
        },
      ],
      firstActive: 0,
    };
  };
  return (
    <form className="grid max-w-xl gap-4" onSubmit={submit} onKeyDown={submitOnCtrlEnter(ready)}>
      <PersonaField personas={personas} personaId={personaId} onChange={(value) => set("persona", value)} />
      <RepositoryPicker
        tenantId={tenantId}
        id={repositoryId}
        selected={target}
        acceptsTyped={false}
        nextFocusId={issueId}
        onPick={pick}
      />
      <Field
        id={issueId}
        label="Issue"
        error={fieldError}
        hint="Open issues only. The control plane reads the issue and writes the first prompt."
      >
        <Combobox
          id={issueId}
          value={issueNumber === null ? null : issue === null ? `#${issueNumber}` : `#${issueNumber} ${issue.title}`}
          placeholder={target === null ? "Pick a repository first" : "Pick an open issue"}
          disabled={notConnected || target === null}
          invalid={fieldError !== null}
          describedBy={fieldError === null ? null : `${issueId}-error`}
          nextFocusId={modelId}
          title="Pick an open issue"
          searchLabel="Search open issues"
          searchPlaceholder="Search open issues"
          view={issueView}
          onChoose={(picked) => {
            pickIssue(picked);
            return "Picked";
          }}
        />
      </Field>
      <ModelField id={modelId} model={model} onChange={(value) => set("model", value)} />
      {issueNumber !== null && fieldError === null && (
        <div className="grid gap-1 rounded-md border bg-muted p-3 text-sm">
          <p className="font-semibold">The first prompt asks for:</p>
          <p className="font-mono text-xs">a branch ticket/{issueNumber}-… named after the title</p>
          <p>a draft pull request that closes #{issueNumber}</p>
        </div>
      )}
      {start.isError && fieldError === null && <StartRefusal tenantId={tenantId} error={start.error} />}
      <SubmitRow tenantId={tenantId} pending={start.isPending} ready={ready} />
    </form>
  );
};

const PromptForm = ({ tenantId, personas }: { tenantId: string; personas: Persona[] }) => {
  const api = useTenantApi(tenantId);
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const repositoryId = useId();
  const modelId = useId();
  const promptId = useId();
  const [prompt, setPrompt] = useState(search.prompt[0] ?? "");
  const personaId = search.persona[0] ?? personas[0]?.personaId ?? "";
  const model = search.model[0] ?? "";
  const start = useStart(tenantId, (body: SessionStart) => api.startSession(body));
  const { target, choice, pick } = useRepositorySearch(tenantId, true, () => start.reset());
  const set = (field: "persona" | "model", value: string) => {
    start.reset();
    void navigate({ search: (current) => ({ ...current, [field]: value === "" ? [] : [value] }), replace: true });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice === null) return;
    start.mutate({ personaId, repository: htmlUrlOf(choice), model: model.trim(), prompt: prompt.trim() });
  };
  const ready = personaId !== "" && choice !== null && model.trim() !== "" && prompt.trim() !== "";
  return (
    <form className="grid max-w-xl gap-4" onSubmit={submit} onKeyDown={submitOnCtrlEnter(ready)}>
      <PersonaField personas={personas} personaId={personaId} onChange={(value) => set("persona", value)} />
      <RepositoryPicker
        tenantId={tenantId}
        id={repositoryId}
        selected={target}
        acceptsTyped
        nextFocusId={modelId}
        onPick={pick}
      />
      <ModelField id={modelId} model={model} onChange={(value) => set("model", value)} />
      <Field id={promptId} label="Prompt" error={null} hint={null}>
        <Textarea
          id={promptId}
          rows={6}
          placeholder="Describe the work..."
          value={prompt}
          onChange={(event) => {
            start.reset();
            setPrompt(event.target.value);
          }}
        />
      </Field>
      {start.isError && <StartRefusal tenantId={tenantId} error={start.error} />}
      <SubmitRow tenantId={tenantId} pending={start.isPending} ready={ready} />
    </form>
  );
};

export const StartSessionScreen = () => {
  const { tenantId } = useParams({ from: ROUTE });
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const personas = usePersonas(tenantId);
  const source: StartSource = search.source[0] ?? "issue";
  const pickSource = (next: StartSource) =>
    void navigate({ search: (current) => ({ ...current, source: [next] }), replace: true });
  const writePrompt = () => pickSource("prompt");
  const crumb = (
    <Link
      to="/t/$tenantId/sessions"
      params={{ tenantId }}
      search={{ state: [], hostId: [], trigger: [] }}
      className="hover:underline"
    >
      Sessions /
    </Link>
  );
  const body = () => {
    if (personas.isPending) {
      return (
        <div aria-busy className="grid max-w-xl gap-4">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="grid gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      );
    }
    if (personas.isError) return <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />;
    if (personas.data.length === 0) {
      return (
        <EmptyState
          title="No persona yet"
          detail="A persona names the harness, its files and its secret set. Create one with tumpel persona create --file persona.json, then check again."
          action={
            <Button variant="outline" onClick={() => void personas.refetch()}>
              Check again
            </Button>
          }
        />
      );
    }
    if (source === "issue") {
      return <IssueForm tenantId={tenantId} personas={personas.data} onWritePrompt={writePrompt} />;
    }
    return <PromptForm tenantId={tenantId} personas={personas.data} />;
  };
  return (
    <>
      <PageHeader title="Start a session" crumb={crumb} />
      <SourceTabs source={source} onPick={pickSource} />
      {body()}
    </>
  );
};
