import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Prebuild } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime } from "../fleet";
import { cn } from "../lib";
import {
  BUILD_PROVIDERS,
  connectedProviders,
  finishedAtOf,
  formatBytes,
  PREBUILD_STATES,
  PROVIDER_NAMES,
  repositoryName,
  sessionIdOfLogUrl,
  shortDigest,
  standingFailure,
} from "../prebuild-rows";
import { NO_WIZARD_SEARCH } from "../prebuild-wizard";
import {
  useConnections,
  useLatestPrebuilds,
  useOwner,
  usePersonas,
  usePrebuildFailure,
  usePrebuilds,
} from "../queries";
import { RebuildPrebuildDialog } from "./rebuild-prebuild";

const ROUTE = "/t/$tenantId/prebuilds";

const PrebuildStateBadge = ({ state }: { state: Prebuild["status"]["state"] }) => {
  if (state === "Done") return <Badge variant="success">Done</Badge>;
  if (state === "Failed") return <Badge variant="destructive">Failed</Badge>;
  return (
    <Badge variant="primary">
      <LoaderCircleIcon className="animate-spin" aria-hidden />
      {state}
    </Badge>
  );
};

const shortTime = (iso: string): string => formatTime(Date.parse(iso)).slice(5, 16);

export const LogLink = ({ tenantId, prebuild }: { tenantId: string; prebuild: Prebuild }) => {
  const sessionId = sessionIdOfLogUrl(prebuild.logUrl);
  return (
    <Button asChild variant="outline" size="sm">
      {sessionId === undefined ? (
        <a href={prebuild.logUrl} target="_blank" rel="noreferrer">
          Open provider log
          <ExternalLinkIcon aria-hidden />
        </a>
      ) : (
        <Link to="/t/$tenantId/sessions/$sessionId" params={{ tenantId, sessionId }}>
          Open log
        </Link>
      )}
    </Button>
  );
};

const TableLogLink = ({ prebuild }: { prebuild: Prebuild }) => {
  const { tenantId } = useParams({ from: ROUTE });
  const sessionId = sessionIdOfLogUrl(prebuild.logUrl);
  const className = "inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline";
  if (sessionId !== undefined) {
    return (
      <Link className={className} to="/t/$tenantId/sessions/$sessionId" params={{ tenantId, sessionId }}>
        Open log
      </Link>
    );
  }
  return (
    <a className={className} href={prebuild.logUrl} target="_blank" rel="noreferrer">
      Log
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  );
};

const RebuildLink = () => (
  <Button asChild size="sm" variant="outline">
    <Link to="." hash="rebuild" search={(search) => search}>
      Rebuild
    </Link>
  </Button>
);

const NewPrebuildLink = ({ tenantId }: { tenantId: string }) => (
  <Button asChild>
    <Link to="/t/$tenantId/prebuilds/new" params={{ tenantId }} search={NO_WIZARD_SEARCH}>
      New prebuild
    </Link>
  </Button>
);

const TemplateStepLink = ({
  tenantId,
  repository,
  personaId,
  label,
}: {
  tenantId: string;
  repository: string;
  personaId: string | null;
  label: string;
}) => (
  <Button asChild size="sm" variant="outline">
    <Link
      to="/t/$tenantId/prebuilds/new/template"
      params={{ tenantId }}
      search={{ ...NO_WIZARD_SEARCH, repo: repositoryName(repository), persona: personaId }}
    >
      {label}
    </Link>
  </Button>
);

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

const mono = (text: string) => <span className="font-mono text-[13px]">{text}</span>;

const FailurePanel = ({
  tenantId,
  prebuild,
  canRebuild,
}: {
  tenantId: string;
  prebuild: Prebuild;
  canRebuild: boolean;
}) => {
  const failure = usePrebuildFailure(tenantId, prebuild.prebuildId);
  if (failure.isPending) return <Skeleton className="h-32 w-full" />;
  if (failure.isError) return <ProblemBlock error={failure.error} onRetry={() => void failure.refetch()} />;
  const finishedAt = finishedAtOf(prebuild);
  return (
    <div className="grid gap-3">
      <ProblemCard
        wording={{
          title: `Prebuild failed in ${failure.data.phase}: ${repositoryName(prebuild.repository)}`,
          detail: failure.data.detail,
          fix: `${failure.data.fix} Boxes start from the image alone until a prebuild of this repository is Done.`,
        }}
        actions={
          <>
            {canRebuild && <RebuildLink />}
            <LogLink tenantId={tenantId} prebuild={prebuild} />
          </>
        }
      />
      <Facts
        facts={[
          ["Phase", `${failure.data.phase} (of Dispatch, Build, Upload, Conversion)`],
          ["Provider", PROVIDER_NAMES[prebuild.provider]],
          ["Input digest", mono(shortDigest(prebuild.inputDigest))],
          ["Started", formatTime(Date.parse(prebuild.startedAt))],
          ["Finished", finishedAt === null ? "" : formatTime(Date.parse(finishedAt))],
        ]}
      />
    </div>
  );
};

const LatestPanel = ({
  tenantId,
  prebuild,
  canRebuild,
  onRefresh,
}: {
  tenantId: string;
  prebuild: Prebuild;
  canRebuild: boolean;
  onRefresh: () => void;
}) => {
  const status = prebuild.status;
  const started = formatTime(Date.parse(prebuild.startedAt));
  if (status.state === "Failed") return null;
  if (status.state === "Done") {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{repositoryName(prebuild.repository)}</h2>
          <PrebuildStateBadge state="Done" />
          <span className="flex-1" />
          {canRebuild && <RebuildLink />}
          <LogLink tenantId={tenantId} prebuild={prebuild} />
        </div>
        <Facts
          facts={[
            ["Input digest", mono(prebuild.inputDigest)],
            ["Layer", `${formatBytes(status.layerSizeBytes)}, ${shortDigest(status.layerDigest)}`],
            ["Ran", `${PROVIDER_NAMES[prebuild.provider]}, ${started} to ${formatTime(Date.parse(status.finishedAt))}`],
            ["Guest image", mono(shortDigest(prebuild.guestImageDigest))],
            ["Used by", "Sessions on this repository whose inputs match this digest"],
          ]}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{repositoryName(prebuild.repository)}</h2>
        <PrebuildStateBadge state={status.state} />
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
        <LogLink tenantId={tenantId} prebuild={prebuild} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {status.state} on {PROVIDER_NAMES[prebuild.provider]} since {started}. The row re-reads on window focus and on
        Refresh.
      </p>
      <Facts facts={[["Input digest", mono(prebuild.inputDigest)]]} />
    </div>
  );
};

const DefaultConfigNote = ({ tenantId, prebuild }: { tenantId: string; prebuild: Prebuild }) => (
  <div role="note" className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
    <p className="min-w-0 flex-1">
      Built with the default setup. A new build needs a devcontainer.json: pick a template to add one in a pull request.
    </p>
    <TemplateStepLink
      tenantId={tenantId}
      repository={prebuild.repository}
      personaId={prebuild.personaId}
      label="Pick a template"
    />
  </div>
);

const SelectedPanel = ({
  tenantId,
  repository,
  canRebuild,
}: {
  tenantId: string;
  repository: string;
  canRebuild: boolean;
}) => {
  const list = usePrebuilds(tenantId, repository);
  const latest = list.data?.[0];
  const failed = standingFailure(list.data ?? []);
  const body = () => {
    if (list.isPending) return <Skeleton className="h-24 w-full" />;
    if (list.isError) return <ProblemBlock error={list.error} onRetry={() => void list.refetch()} />;
    if (latest === undefined) {
      return (
        <div className="grid justify-items-start gap-2">
          <h2 className="font-semibold">{repositoryName(repository)}</h2>
          <p className="text-sm text-muted-foreground">
            No prebuild yet. Boxes start from the image alone until a prebuild is Done.
          </p>
          {canRebuild && (
            <TemplateStepLink tenantId={tenantId} repository={repository} personaId={null} label="Set up a prebuild" />
          )}
        </div>
      );
    }
    return (
      <div className="grid gap-4">
        {latest.configSource === "Default" && <DefaultConfigNote tenantId={tenantId} prebuild={latest} />}
        {failed !== undefined && <FailurePanel tenantId={tenantId} prebuild={failed} canRebuild={canRebuild} />}
        <LatestPanel
          tenantId={tenantId}
          prebuild={latest}
          canRebuild={canRebuild}
          onRefresh={() => void list.refetch()}
        />
      </div>
    );
  };
  return (
    <section
      aria-label={`Prebuild of ${repositoryName(repository)}`}
      className={cn("mt-4 rounded-lg border bg-card p-4", failed !== undefined && "border-2 border-destructive")}
    >
      {body()}
    </section>
  );
};

const StateCell = ({ prebuild }: { prebuild: Prebuild }) => (
  <span className="grid justify-items-start gap-1">
    <PrebuildStateBadge state={prebuild.status.state} />
    {prebuild.status.state === "Failed" && (
      <span className="text-xs font-semibold text-destructive">Failed in {prebuild.status.phase}</span>
    )}
  </span>
);

const PrebuildTable = ({
  prebuilds,
  selected,
  onSelect,
}: {
  prebuilds: Prebuild[];
  selected: string | null;
  onSelect: (repository: string) => void;
}) => (
  <Table mobile>
    <TableHeader>
      <TableRow>
        <TableHead>Repository</TableHead>
        <TableHead>State</TableHead>
        <TableHead>Provider</TableHead>
        <TableHead>Input digest</TableHead>
        <TableHead>Started</TableHead>
        <TableHead>Finished</TableHead>
        <TableHead>Layer</TableHead>
        <TableHead>Log</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {prebuilds.map((prebuild) => {
        const finishedAt = finishedAtOf(prebuild);
        return (
          <TableRow
            key={prebuild.repository}
            aria-selected={selected === prebuild.repository}
            className={cn(
              selected === prebuild.repository && "bg-accent",
              prebuild.status.state === "Failed" && "border-l-4 border-l-destructive",
            )}
          >
            <TableCell mobile="primary">
              <button
                type="button"
                className="text-left font-medium hover:underline"
                onClick={() => onSelect(prebuild.repository)}
              >
                {repositoryName(prebuild.repository)}
              </button>
            </TableCell>
            <TableCell mobile="state">
              <StateCell prebuild={prebuild} />
            </TableCell>
            <TableCell label="Provider">{PROVIDER_NAMES[prebuild.provider]}</TableCell>
            <TableCell label="Input digest">{mono(shortDigest(prebuild.inputDigest))}</TableCell>
            <TableCell label="Started" className="whitespace-nowrap">
              {shortTime(prebuild.startedAt)}
            </TableCell>
            <TableCell label="Finished" className="whitespace-nowrap">
              {finishedAt === null ? "" : shortTime(finishedAt)}
            </TableCell>
            <TableCell label="Layer" className="whitespace-nowrap">
              {prebuild.status.state === "Done" ? formatBytes(prebuild.status.layerSizeBytes) : ""}
            </TableCell>
            <TableCell mobile="action">
              <TableLogLink prebuild={prebuild} />
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

const TableSkeleton = () => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-3">
    {[0, 1, 2, 3].map((row) => (
      <Skeleton key={row} className="h-7 w-full" />
    ))}
  </div>
);

export const PrebuildsScreen = () => {
  const { tenantId } = useParams({ from: ROUTE });
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate({ from: ROUTE });
  const connections = useConnections(tenantId);
  const latest = useLatestPrebuilds(tenantId);
  const personas = usePersonas(tenantId);
  const owner = useOwner(tenantId);
  const selected = search.repo;
  const prebuilds = latest.data ?? [];
  const providers = connectedProviders(connections.data ?? []);
  const canBuild = providers.length > 0;

  const toggleState = (state: Prebuild["status"]["state"]) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        state: prev.state.includes(state) ? prev.state.filter((item) => item !== state) : [...prev.state, state],
      }),
    });
  const pickProvider = (value: string) =>
    void navigate({
      search: (prev) => ({ ...prev, provider: BUILD_PROVIDERS.find((provider) => provider === value) ?? null }),
    });
  const select = (repository: string) => void navigate({ search: (prev) => ({ ...prev, repo: repository }) });

  const visible = prebuilds.filter(
    (prebuild) =>
      (search.state.length === 0 || search.state.includes(prebuild.status.state)) &&
      (search.provider === null || search.provider === prebuild.provider),
  );

  const body = () => {
    if (connections.isPending || latest.isPending) return <TableSkeleton />;
    if (connections.isError) {
      return <ProblemBlock error={connections.error} onRetry={() => void connections.refetch()} />;
    }
    if (latest.isError) return <ProblemBlock error={latest.error} onRetry={() => void latest.refetch()} />;
    if (providers.length === 0) {
      return (
        <EmptyState
          title="No build provider connected"
          detail={
            owner
              ? "Prebuilds run on your own GitHub Actions or Namespace account. Connect one to build."
              : "Prebuilds run on the tenant's own GitHub Actions or Namespace account. Ask an Owner to connect a provider."
          }
          action={
            <Button asChild>
              <Link to="/t/$tenantId/connections" params={{ tenantId }} hash="providers">
                {owner ? "Connect a provider" : "Open Connections"}
              </Link>
            </Button>
          }
        />
      );
    }
    if (prebuilds.length === 0) {
      return (
        <EmptyState
          title="No prebuild yet"
          detail="A repository shows here once its first prebuild starts. New prebuild picks a repository and a template, and opens a pull request that adds its devcontainer.json."
          action={<NewPrebuildLink tenantId={tenantId} />}
        />
      );
    }
    if (visible.length === 0) {
      return (
        <div className="grid justify-items-start gap-2 rounded-lg border bg-card p-6">
          <p className="font-medium">No repository's latest prebuild matches this filter</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigate({ search: (prev) => ({ ...prev, state: [], provider: null }) })}
          >
            Clear filter
          </Button>
        </div>
      );
    }
    return (
      <>
        <PrebuildTable prebuilds={visible} selected={selected} onSelect={select} />
        {selected !== null && <SelectedPanel tenantId={tenantId} repository={selected} canRebuild={canBuild} />}
      </>
    );
  };

  return (
    <>
      <PageHeader title="Prebuilds" actions={canBuild ? <NewPrebuildLink tenantId={tenantId} /> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filter by state</legend>
          {PREBUILD_STATES.map((state) => {
            const on = search.state.includes(state);
            return (
              <button
                key={state}
                type="button"
                aria-pressed={on}
                onClick={() => toggleState(state)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {state}
                {on && <XIcon className="size-3" aria-hidden />}
              </button>
            );
          })}
        </fieldset>
        <span className="flex-1" />
        <label className="sr-only" htmlFor="provider-filter">
          Provider
        </label>
        <NativeSelect
          id="provider-filter"
          className="w-44"
          value={search.provider ?? ""}
          onChange={(event) => pickProvider(event.target.value)}
        >
          <option value="">Any provider</option>
          {BUILD_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_NAMES[provider]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {body()}
      {canBuild && selected !== null && (
        <RebuildPrebuildDialog
          tenantId={tenantId}
          repository={selected}
          latest={prebuilds.find((prebuild) => prebuild.repository === selected) ?? null}
          providers={providers}
          personas={personas}
        />
      )}
    </>
  );
};
