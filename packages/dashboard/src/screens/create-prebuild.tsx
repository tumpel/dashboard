import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import {
  failureOf,
  type Persona,
  type Prebuild,
  type PrebuildPreview,
  type PrebuildStart,
  type PrebuildTemplate,
  type PrebuildTemplateVersion,
} from "../api/port";
import { Field } from "../components/field";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { RepositoryPicker } from "../components/repository-picker";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { formatTime } from "../fleet";
import {
  commandText,
  LIFECYCLE_STEPS,
  NO_WIZARD_SEARCH,
  repositoryUrlOf,
  type TemplateRef,
  templateLabel,
  templateRefOf,
  templateRefText,
  type WizardSearch,
} from "../prebuild-wizard";
import {
  prebuildKeys,
  templateKeys,
  usePersonas,
  usePrebuildFailure,
  usePrebuilds,
  usePrebuildTemplate,
  usePrebuildTemplates,
  useRepositoryConfig,
  useTemplatePreview,
  useTemplatePullRequest,
} from "../queries";
import { fullName, pathOf, typedPathOf } from "../repository-picker";
import { LogLink } from "./prebuilds";

const STEP_ROUTES = {
  repository: "/t/$tenantId/prebuilds/new",
  template: "/t/$tenantId/prebuilds/new/template",
  preview: "/t/$tenantId/prebuilds/new/preview",
  merge: "/t/$tenantId/prebuilds/new/merge",
  build: "/t/$tenantId/prebuilds/new/build",
} as const;

const button = "max-sm:h-12 max-sm:flex-1";

const hasCode = (error: unknown, codes: readonly string[]): boolean => {
  const failure = failureOf(error);
  return failure.kind === "Problem" && codes.includes(failure.problem.code);
};

const WizardFrame = ({
  tenantId,
  step,
  title,
  children,
}: {
  tenantId: string;
  step: number;
  title: string;
  children: ReactNode;
}) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <>
      <div className="mb-5">
        <div className="text-[13px] text-muted-foreground">
          <Link
            to="/t/$tenantId/prebuilds"
            params={{ tenantId }}
            search={{ state: [], repo: null }}
            className="hover:underline"
          >
            Prebuilds /
          </Link>
        </div>
        <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">
          {title}
        </h1>
      </div>
      <div className="grid max-w-2xl gap-4">
        <p className="text-sm text-muted-foreground">Step {step} of 5</p>
        {children}
      </div>
    </>
  );
};

const Buttons = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

const CancelLink = ({
  tenantId,
  repo,
  label = "Cancel",
}: {
  tenantId: string;
  repo: string | null;
  label?: string;
}) => (
  <Button variant="outline" className={button} asChild>
    <Link
      to="/t/$tenantId/prebuilds"
      params={{ tenantId }}
      search={{ state: [], repo: repo === null ? null : repositoryUrlOf(repo) }}
    >
      {label}
    </Link>
  </Button>
);

const StepLink = ({
  tenantId,
  to,
  search,
  children,
  variant = "outline",
  id,
}: {
  tenantId: string;
  to: StepRoute;
  search: WizardSearch;
  children: ReactNode;
  variant?: "outline" | "default";
  id?: string;
}) => (
  <Button variant={variant} className={button} asChild>
    <Link id={id} to={to} params={{ tenantId }} search={search}>
      {children}
    </Link>
  </Button>
);

const PersonaGate = ({
  tenantId,
  picked,
  children,
}: {
  tenantId: string;
  picked: string | null;
  children: (persona: Persona, personas: Persona[]) => ReactNode;
}) => {
  const personas = usePersonas(tenantId);
  if (personas.isPending) return <Skeleton className="h-24 w-full" />;
  if (personas.isError) return <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />;
  const persona = personas.data.find((item) => item.personaId === picked) ?? personas.data[0];
  if (persona === undefined) {
    return (
      <div role="note" className="grid justify-items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
        <p>This tenant has no persona yet. A prebuild runs as a persona, so create one first.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/t/$tenantId/personas/new" params={{ tenantId }} search={{ harness: [], file: [] }}>
            Create a persona
          </Link>
        </Button>
      </div>
    );
  }
  return children(persona, personas.data);
};

export const RepositoryStepScreen = () => {
  const { tenantId } = useParams({ from: STEP_ROUTES.repository });
  const search = useSearch({ from: STEP_ROUTES.repository });
  const navigate = useNavigate({ from: STEP_ROUTES.repository });
  const selected = search.repo === null ? null : typedPathOf(search.repo);
  return (
    <WizardFrame tenantId={tenantId} step={1} title="Pick a repository">
      <RepositoryPicker
        tenantId={tenantId}
        id="prebuild-repository"
        selected={selected}
        acceptsTyped
        nextFocusId="prebuild-next"
        onPick={(choice) => void navigate({ search: { ...search, repo: fullName(pathOf(choice)) } })}
      />
      <PersonaGate tenantId={tenantId} picked={search.persona}>
        {(persona, personas) => (
          <Field
            id="prebuild-persona"
            label="Persona"
            error={null}
            hint="Its harness version picks the guest image; its GITHUB_TOKEN reads the repository when the GitHub App does not cover it."
          >
            <NativeSelect
              id="prebuild-persona"
              value={persona.personaId}
              onChange={(event) => void navigate({ search: { ...search, persona: event.target.value } })}
            >
              {personas.map((item) => (
                <option key={item.personaId} value={item.personaId}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </PersonaGate>
      <Buttons>
        {search.repo === null ? (
          <Button id="prebuild-next" className={button} disabled>
            Next
          </Button>
        ) : (
          <StepLink
            tenantId={tenantId}
            id="prebuild-next"
            variant="default"
            to={STEP_ROUTES.template}
            search={{ ...NO_WIZARD_SEARCH, repo: search.repo, persona: search.persona }}
          >
            Next
          </StepLink>
        )}
        <CancelLink tenantId={tenantId} repo={search.repo} />
      </Buttons>
    </WizardFrame>
  );
};

type StepRoute = (typeof STEP_ROUTES)[keyof typeof STEP_ROUTES];

const ToStep = ({ tenantId, to, search }: { tenantId: string; to: StepRoute; search: WizardSearch }) => (
  <Navigate to={to} params={{ tenantId }} search={search} replace />
);

const ExistingConfigNote = ({
  tenantId,
  repo,
  personaId,
  search,
}: {
  tenantId: string;
  repo: string;
  personaId: string;
  search: WizardSearch;
}) => {
  const config = useRepositoryConfig(tenantId, repositoryUrlOf(repo), personaId);
  if (config.isError) return <ProblemBlock error={config.error} onRetry={() => void config.refetch()} />;
  if (config.data?.kind !== "Present") return null;
  return (
    <div role="note" className="grid justify-items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <p>{repo} already holds a devcontainer.json. A template replaces it. To keep it, build from it as it is.</p>
      <StepLink
        tenantId={tenantId}
        to={STEP_ROUTES.build}
        search={{ ...NO_WIZARD_SEARCH, repo, persona: search.persona }}
      >
        Build with the current file
      </StepLink>
    </div>
  );
};

const toolchainLine = (version: PrebuildTemplate["versions"][number]): string =>
  version.toolchains.map((item) => `${item.toolchain} ${item.toolchainVersion}`).join(", ");

const TemplateCard = ({
  tenantId,
  template,
  search,
}: {
  tenantId: string;
  template: PrebuildTemplate;
  search: WizardSearch;
}) => {
  const [newest, ...older] = template.versions;
  if (newest === undefined) return null;
  const linkTo = (prebuildTemplateVersion: number) => ({
    ...search,
    template: templateRefText({ prebuildTemplateId: template.prebuildTemplateId, prebuildTemplateVersion }),
  });
  return (
    <li className="grid gap-2 rounded-lg border bg-card p-4">
      <Link
        to={STEP_ROUTES.preview}
        params={{ tenantId }}
        search={linkTo(newest.prebuildTemplateVersion)}
        className="grid gap-1 rounded-md hover:underline"
      >
        <span className="flex items-center gap-2 font-semibold">
          {template.prebuildTemplateId}
          <Badge>v{newest.prebuildTemplateVersion}</Badge>
        </span>
        <span className="text-sm text-muted-foreground">
          {toolchainLine(newest)}. {newest.summary}
        </span>
      </Link>
      {older.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-primary">Other versions</summary>
          <ul className="mt-2 grid gap-1">
            {older.map((version) => (
              <li key={version.prebuildTemplateVersion}>
                <Link
                  to={STEP_ROUTES.preview}
                  params={{ tenantId }}
                  search={linkTo(version.prebuildTemplateVersion)}
                  className="hover:underline"
                >
                  v{version.prebuildTemplateVersion}: {toolchainLine(version)}. {version.summary}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
};

export const TemplateStepScreen = () => {
  const { tenantId } = useParams({ from: STEP_ROUTES.template });
  const search = useSearch({ from: STEP_ROUTES.template });
  const templates = usePrebuildTemplates(tenantId);
  const repo = search.repo;
  if (repo === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.repository} search={search} />;
  const list = () => {
    if (templates.isPending) return <Skeleton className="h-40 w-full" />;
    if (templates.isError) {
      return <ProblemBlock error={templates.error} retryLabel="Try again" onRetry={() => void templates.refetch()} />;
    }
    return (
      <ul className="grid gap-3">
        {templates.data.map((template) => (
          <TemplateCard key={template.prebuildTemplateId} tenantId={tenantId} template={template} search={search} />
        ))}
      </ul>
    );
  };
  return (
    <WizardFrame tenantId={tenantId} step={2} title="Pick a template">
      <p className="text-sm">For {repo}. Each template runs the commands below on Tumpel's image.</p>
      <PersonaGate tenantId={tenantId} picked={search.persona}>
        {(persona) => (
          <ExistingConfigNote tenantId={tenantId} repo={repo} personaId={persona.personaId} search={search} />
        )}
      </PersonaGate>
      {list()}
      <Buttons>
        <StepLink
          tenantId={tenantId}
          to={STEP_ROUTES.repository}
          search={{ ...NO_WIZARD_SEARCH, repo, persona: search.persona }}
        >
          Back
        </StepLink>
        <CancelLink tenantId={tenantId} repo={repo} />
      </Buttons>
    </WizardFrame>
  );
};

const LifecycleList = ({ preview }: { preview: PrebuildPreview }) => (
  <ol className="grid gap-3">
    {LIFECYCLE_STEPS.map((step, index) => {
      const commands = preview.commands.filter((command) => command.lifecycle === step.lifecycle);
      return (
        <li key={step.lifecycle} className="grid grid-cols-[1.5rem_1fr] gap-x-2 rounded-md border bg-card p-3">
          <span className="font-semibold text-muted-foreground">{index + 1}</span>
          <div className="grid gap-1">
            <p className="font-mono text-[13px] font-semibold">{step.field}</p>
            <p className="text-sm text-muted-foreground">{step.note}</p>
            {commands.length === 0 && <p className="text-sm text-muted-foreground italic">not set</p>}
            {commands.map((command) => (
              <p key={command.label} className="font-mono text-[13px] break-all">
                {command.label === step.field ? "" : `${command.label.slice(step.field.length + 1)}: `}
                {commandText(command.argv)}
              </p>
            ))}
          </div>
        </li>
      );
    })}
  </ol>
);

const Findings = ({ preview }: { preview: PrebuildPreview | undefined }) => (
  <div aria-live="polite">
    {preview !== undefined && preview.findings.length > 0 && (
      <div className="grid gap-2 rounded-lg border-2 border-destructive bg-card p-4 text-sm">
        <h3 className="font-semibold">A prebuild of this config would fail</h3>
        <ul className="grid gap-2">
          {preview.findings.map((finding) => (
            <li key={`${finding.code}-${finding.field}`}>
              <span className="font-mono text-[13px]">{finding.field}</span>: {finding.detail}{" "}
              <span className="text-muted-foreground">{finding.fix}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const PreviewBody = ({
  tenantId,
  repo,
  personaId,
  templateRef,
  template,
  search,
}: {
  tenantId: string;
  repo: string;
  personaId: string;
  templateRef: TemplateRef;
  template: PrebuildTemplateVersion;
  search: WizardSearch;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const repository = repositoryUrlOf(repo);
  const config = useRepositoryConfig(tenantId, repository, personaId);
  const preview = useTemplatePreview(tenantId, repository, personaId, template);
  const replace = config.data?.kind === "Present";
  const open = useMutation({
    mutationFn: () =>
      api.openTemplatePullRequest({
        repository,
        prebuildTemplateId: templateRef.prebuildTemplateId,
        prebuildTemplateVersion: templateRef.prebuildTemplateVersion,
        replace,
      }),
    onSuccess: (pullRequest) => {
      queryClient.setQueryData(templateKeys.pullRequest(tenantId, repository), pullRequest);
      void navigate({
        to: STEP_ROUTES.merge,
        params: { tenantId },
        search: { ...search, pr: String(pullRequest.pullRequestNumber) },
      });
    },
  });
  const ready = preview.isSuccess && preview.data.findings.length === 0 && config.isSuccess;
  return (
    <>
      <p className="text-sm">
        Tumpel commits this file to {repo} in a pull request
        {replace ? ", replacing the devcontainer.json on its default branch" : ""}. Review the file and the merge on
        GitHub.
      </p>
      <figure className="grid gap-1">
        <pre className="rounded-md border bg-muted/40 p-3 font-mono text-[13px] break-all whitespace-pre-wrap">
          {template.devcontainer}
        </pre>
        <figcaption className="text-xs text-muted-foreground">
          .devcontainer/devcontainer.json from {templateLabel(templateRef)} (read-only)
        </figcaption>
      </figure>
      <h2 className="font-semibold">What each step does</h2>
      {preview.isPending && <Skeleton className="h-40 w-full" />}
      {preview.isError && (
        <ProblemBlock error={preview.error} retryLabel="Try again" onRetry={() => void preview.refetch()} />
      )}
      {preview.isSuccess && <LifecycleList preview={preview.data} />}
      <Findings preview={preview.data} />
      {config.isError && <ProblemBlock error={config.error} onRetry={() => void config.refetch()} />}
      {open.isError && (
        <ProblemBlock
          error={open.error}
          retryLabel="Try again"
          onRetry={() => open.mutate()}
          actions={
            hasCode(open.error, ["GitHubNotConnected", "GitHubAppMissing", "GitHubRefused"]) ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/t/$tenantId/connections" params={{ tenantId }}>
                  Open Connections
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
      <Buttons>
        <Button
          className={button}
          disabled={!ready || open.isPending}
          aria-busy={open.isPending}
          onClick={() => open.mutate()}
        >
          {open.isPending ? "Opening pull request..." : "Open pull request"}
        </Button>
        <StepLink tenantId={tenantId} to={STEP_ROUTES.template} search={{ ...search, template: null }}>
          Back
        </StepLink>
        <CancelLink tenantId={tenantId} repo={repo} />
      </Buttons>
    </>
  );
};

const TemplateBody = ({
  tenantId,
  repo,
  templateRef,
  search,
}: {
  tenantId: string;
  repo: string;
  templateRef: TemplateRef;
  search: WizardSearch;
}) => {
  const template = usePrebuildTemplate(tenantId, templateRef.prebuildTemplateId, templateRef.prebuildTemplateVersion);
  if (template.isPending) return <Skeleton className="h-80 w-full" />;
  if (template.isError) {
    return (
      <ProblemBlock
        error={template.error}
        retryLabel="Try again"
        onRetry={() => void template.refetch()}
        actions={
          <StepLink tenantId={tenantId} to={STEP_ROUTES.template} search={{ ...search, template: null }}>
            Back
          </StepLink>
        }
      />
    );
  }
  return (
    <PersonaGate tenantId={tenantId} picked={search.persona}>
      {(persona) => (
        <PreviewBody
          tenantId={tenantId}
          repo={repo}
          personaId={persona.personaId}
          templateRef={templateRef}
          template={template.data}
          search={search}
        />
      )}
    </PersonaGate>
  );
};

export const PreviewStepScreen = () => {
  const { tenantId } = useParams({ from: STEP_ROUTES.preview });
  const search = useSearch({ from: STEP_ROUTES.preview });
  const ref = templateRefOf(search.template);
  if (search.repo === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.repository} search={search} />;
  if (ref === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.template} search={search} />;
  return (
    <WizardFrame tenantId={tenantId} step={3} title="Check the config">
      <TemplateBody tenantId={tenantId} repo={search.repo} templateRef={ref} search={search} />
    </WizardFrame>
  );
};

const MergeBody = ({
  tenantId,
  repo,
  pr,
  search,
}: {
  tenantId: string;
  repo: string;
  pr: string;
  search: WizardSearch;
}) => {
  const pullRequest = useTemplatePullRequest(tenantId, repositoryUrlOf(repo));
  const state = pullRequest.data?.state;
  const checking = pullRequest.isFetching;
  const status = () => {
    if (checking) return "Checking the pull request...";
    if (state === "Merged") return "Merged. Continue to build the prebuild.";
    if (state === "Open") {
      return "Waiting for the merge. This page checks again when you return to this tab, or on Check again.";
    }
    return "";
  };
  return (
    <>
      <div className="grid gap-2 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            Pull request #{pullRequest.data?.pullRequestNumber ?? pr} on {repo}
          </h2>
          {state !== undefined && <Badge variant={state === "Merged" ? "success" : "outline"}>{state}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          It adds .devcontainer/devcontainer.json. Merge it on GitHub, then come back here.
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            <a href={pullRequest.data?.url ?? `https://github.com/${repo}/pull/${pr}`} target="_blank" rel="noreferrer">
              Open on GitHub
              <ExternalLinkIcon aria-hidden />
            </a>
          </Button>
        </div>
        <p role="status" aria-live="polite" className="text-sm">
          {status()}
        </p>
      </div>
      {pullRequest.isError && !checking && (
        <ProblemBlock error={pullRequest.error} retryLabel="Try again" onRetry={() => void pullRequest.refetch()} />
      )}
      {state === "Closed" && !checking && (
        <ProblemCard
          wording={{
            title: "The pull request was closed without a merge",
            detail: `GitHub reports pull request #${pullRequest.data?.pullRequestNumber ?? pr} on ${repo} as closed and unmerged.`,
            fix: "Go back to the config to open a new pull request.",
          }}
          actions={
            <StepLink tenantId={tenantId} to={STEP_ROUTES.preview} search={{ ...search, pr: null }}>
              Back to the config
            </StepLink>
          }
        />
      )}
      <Buttons>
        <Button
          variant="outline"
          className={button}
          aria-busy={checking}
          disabled={checking}
          onClick={() => void pullRequest.refetch()}
        >
          {checking ? "Checking" : "Check again"}
        </Button>
        {state === "Merged" ? (
          <StepLink tenantId={tenantId} variant="default" to={STEP_ROUTES.build} search={search}>
            Continue
          </StepLink>
        ) : (
          <Button className={button} disabled>
            Continue
          </Button>
        )}
        <CancelLink tenantId={tenantId} repo={repo} />
      </Buttons>
    </>
  );
};

export const MergeStepScreen = () => {
  const { tenantId } = useParams({ from: STEP_ROUTES.merge });
  const search = useSearch({ from: STEP_ROUTES.merge });
  if (search.repo === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.repository} search={search} />;
  if (search.pr === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.preview} search={search} />;
  return (
    <WizardFrame tenantId={tenantId} step={4} title="Merge the pull request">
      <MergeBody tenantId={tenantId} repo={search.repo} pr={search.pr} search={search} />
    </WizardFrame>
  );
};

const Facts = ({ facts }: { facts: ReadonlyArray<readonly [string, ReactNode]> }) => (
  <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
    {facts.map(([name, value]) => (
      <div key={name} className="contents">
        <dt className="text-muted-foreground">{name}</dt>
        <dd className="min-w-0 break-all">{value}</dd>
      </div>
    ))}
  </dl>
);

const changeConfigSearch = (search: WizardSearch): WizardSearch => ({ ...search, pr: null, prebuild: null });

const BuildStatus = ({
  tenantId,
  repo,
  prebuild,
  search,
  focus,
  onRefresh,
  onBuildAgain,
  building,
}: {
  tenantId: string;
  repo: string;
  prebuild: Prebuild;
  search: WizardSearch;
  focus: boolean;
  onRefresh: () => void;
  onBuildAgain: () => void;
  building: boolean;
}) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  const status = prebuild.status;
  const line = () => {
    if (status.state === "Done") return `Done. Boxes for ${repo} now start from this prebuild.`;
    if (status.state === "Failed") return `Failed in ${status.phase}.`;
    return `${status.state} since ${formatTime(Date.parse(prebuild.startedAt))}. This page reads it again when you return to this tab, or on Refresh.`;
  };
  return (
    <section aria-labelledby="prebuild-status" className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 id="prebuild-status" ref={heading} tabIndex={-1} className="font-semibold focus:outline-none">
        Prebuild of {repo}
      </h2>
      <p role="status" aria-live="polite" className="text-sm">
        {line()}
      </p>
      {status.state === "Failed" && (
        <BuildFailure
          tenantId={tenantId}
          prebuild={prebuild}
          search={search}
          onBuildAgain={onBuildAgain}
          building={building}
        />
      )}
      {status.state !== "Failed" && (
        <div className="flex flex-wrap gap-2">
          {status.state === "Done" ? (
            <Button asChild size="sm">
              <Link
                to="/t/$tenantId/sessions/new"
                params={{ tenantId }}
                search={{ source: [], persona: [prebuild.personaId], repo: [repo], issue: [], model: [], prompt: [] }}
              >
                Start a session
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
          )}
          <LogLink tenantId={tenantId} prebuild={prebuild} />
        </div>
      )}
    </section>
  );
};

const BuildFailure = ({
  tenantId,
  prebuild,
  search,
  onBuildAgain,
  building,
}: {
  tenantId: string;
  prebuild: Prebuild;
  search: WizardSearch;
  onBuildAgain: () => void;
  building: boolean;
}) => {
  const failure = usePrebuildFailure(tenantId, prebuild.prebuildId);
  if (failure.isPending) return <Skeleton className="h-24 w-full" />;
  if (failure.isError) return <ProblemBlock error={failure.error} onRetry={() => void failure.refetch()} />;
  return (
    <ProblemCard
      wording={{
        title: `Prebuild failed in ${failure.data.phase}`,
        detail: failure.data.detail,
        fix: failure.data.fix,
      }}
      actions={
        <>
          <LogLink tenantId={tenantId} prebuild={prebuild} />
          <Button size="sm" variant="outline" disabled={building} onClick={onBuildAgain}>
            {building ? "Starting..." : "Build again"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link
              to={search.template === null ? STEP_ROUTES.template : STEP_ROUTES.preview}
              params={{ tenantId }}
              search={changeConfigSearch(search)}
            >
              Change the config
            </Link>
          </Button>
        </>
      }
    />
  );
};

const BuildBody = ({
  tenantId,
  repo,
  persona,
  search,
}: {
  tenantId: string;
  repo: string;
  persona: Persona;
  search: WizardSearch;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const repository = repositoryUrlOf(repo);
  const prebuilds = usePrebuilds(tenantId, repository);
  const ref = templateRefOf(search.template);
  const start = useMutation({
    mutationFn: (body: PrebuildStart) => api.startPrebuild(body),
    onSuccess: (started) => {
      void queryClient.invalidateQueries({ queryKey: prebuildKeys.all(tenantId) });
      void navigate({
        to: STEP_ROUTES.build,
        params: { tenantId },
        search: { ...search, prebuild: started.prebuildId },
      });
    },
  });
  const build = (rebuild: boolean) => start.mutate({ repository, personaId: persona.personaId, rebuild });
  const current =
    search.prebuild === null
      ? undefined
      : (prebuilds.data?.find((item) => item.prebuildId === search.prebuild) ??
        (start.data?.prebuildId === search.prebuild ? start.data : undefined));

  const facts: [string, ReactNode][] = [
    ["Repository", repo],
    ...(ref === null ? [] : ([["Template", templateLabel(ref)]] as [string, ReactNode][])),
    ["Config", search.pr === null ? "The devcontainer.json on the default branch" : `Merged in #${search.pr}`],
    ["Persona", persona.name],
  ];

  const statusPanel = () => {
    if (search.prebuild === null) return null;
    if (current !== undefined) {
      return (
        <BuildStatus
          tenantId={tenantId}
          repo={repo}
          prebuild={current}
          search={search}
          focus={start.isSuccess}
          onRefresh={() => void prebuilds.refetch()}
          onBuildAgain={() => build(true)}
          building={start.isPending}
        />
      );
    }
    if (prebuilds.isError) return <ProblemBlock error={prebuilds.error} onRetry={() => void prebuilds.refetch()} />;
    return <Skeleton className="h-24 w-full" />;
  };

  return (
    <>
      <Facts facts={facts} />
      {search.prebuild === null && (
        <p className="text-sm text-muted-foreground">
          A prebuild runs the config once and stores the result. Boxes for this repository then start from it.
        </p>
      )}
      {start.isError && (
        <ProblemBlock
          error={start.error}
          actions={
            hasCode(start.error, ["DevcontainerMissing"]) && (
              <Button asChild size="sm" variant="outline">
                <Link to={STEP_ROUTES.template} params={{ tenantId }} search={changeConfigSearch(search)}>
                  Pick a template
                </Link>
              </Button>
            )
          }
        />
      )}
      {statusPanel()}
      <Buttons>
        {search.prebuild === null ? (
          <>
            <Button
              className={button}
              disabled={start.isPending}
              aria-busy={start.isPending}
              onClick={() => build(false)}
            >
              {start.isPending ? "Starting..." : "Build now"}
            </Button>
            <CancelLink tenantId={tenantId} repo={repo} />
          </>
        ) : (
          <CancelLink tenantId={tenantId} repo={repo} label="Go to Prebuilds" />
        )}
      </Buttons>
    </>
  );
};

export const BuildStepScreen = () => {
  const { tenantId } = useParams({ from: STEP_ROUTES.build });
  const search = useSearch({ from: STEP_ROUTES.build });
  const repo = search.repo;
  if (repo === null) return <ToStep tenantId={tenantId} to={STEP_ROUTES.repository} search={search} />;
  return (
    <WizardFrame tenantId={tenantId} step={5} title="Build the prebuild">
      <PersonaGate tenantId={tenantId} picked={search.persona}>
        {(persona) => <BuildBody tenantId={tenantId} repo={repo} persona={persona} search={search} />}
      </PersonaGate>
    </WizardFrame>
  );
};
