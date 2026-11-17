import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ConnectionSummary } from "../api/port";
import { CopyValues } from "../components/copy-value";
import { GitHubInstallations } from "../components/github-installations";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { expiryDate, formatTime, repositoryLabel } from "../fleet";
import { type GitHubReturn, gitHubReturnOf, gitHubReturnUrl } from "../github-return";
import {
  useCircleCIConnection,
  useCircleCIProjects,
  useConnections,
  useGitHubActionsConnection,
  useGitHubConnection,
  useGitHubInstallations,
  useNamespaceConnection,
  useOwner,
} from "../queries";
import { CircleCIConnectDialog } from "./circleci-connect";
import {
  type ConnectionHash,
  GitHubActionsConnectDialog,
  GitHubDisconnectDialog,
  NamespaceConnectDialog,
  ProviderDisconnectDialog,
} from "./connection-dialogs";

const StateBadge = ({ state }: { state: ConnectionSummary["state"] }) => {
  if (state === "Connected") return <Badge variant="success">Connected</Badge>;
  if (state === "Expiring") return <Badge variant="warning">Expiring</Badge>;
  if (state === "Expired") return <Badge variant="destructive">Expired</Badge>;
  if (state === "NotConfigured")
    return (
      <Badge variant="outline" className="border-dashed">
        Not configured
      </Badge>
    );
  return <Badge variant="outline">Not connected</Badge>;
};

const ConnectionCard = ({
  mark,
  name,
  state,
  action,
  children,
}: {
  mark: string;
  name: string;
  state: ConnectionSummary["state"];
  action: ReactNode;
  children: ReactNode;
}) => (
  <section aria-label={name} className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
    <div className="flex flex-wrap items-start gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted text-[11px] font-semibold"
      >
        {mark}
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold">{name}</h2>
          <StateBadge state={state} />
        </div>
        <div className="grid gap-1 text-sm">{children}</div>
      </div>
      {action}
    </div>
  </section>
);

const CardSkeleton = () => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-4">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-4 w-80 max-w-full" />
    <Skeleton className="h-4 w-64 max-w-full" />
  </div>
);

const OWNER_ONLY = "Only an Owner connects or disconnects services. Owners are listed under Members.";

const dateOf = (epochMs: number): string => formatTime(epochMs).slice(0, 10);

const hashLink = (hash: ConnectionHash, label: string, variant: "default" | "destructive" | "outline") => (
  <Button asChild variant={variant} size="sm">
    <Link to="." hash={hash} search={(search) => search}>
      {label}
    </Link>
  </Button>
);

const GitHubCard = ({
  tenantId,
  summary,
  owner,
  returned,
  onClear,
}: {
  tenantId: string;
  summary: ConnectionSummary;
  owner: boolean;
  returned: GitHubReturn;
  onClear: () => void;
}) => {
  const github = useGitHubConnection(tenantId);

  const action = () => {
    if (!owner || summary.state !== "NotConfigured" || github.data?.app.state !== "AppMissing") return null;
    return (
      <Button asChild variant="outline" size="sm">
        <a href={github.data.app.setupUrl} target="_blank" rel="noreferrer">
          Open setup page
          <ExternalLinkIcon aria-hidden />
        </a>
      </Button>
    );
  };

  const lines = () => {
    if (summary.state === "NotConfigured") {
      return (
        <>
          <p>This stage has no GitHub App yet. The stage operator creates it once.</p>
          <p className="text-muted-foreground">
            Setup page: /github/app/setup on the control plane{owner ? "." : ". Ask an Owner or the stage operator."}
          </p>
        </>
      );
    }
    return (
      <GitHubInstallations
        tenantId={tenantId}
        owner={owner}
        returned={returned}
        returnUrl={gitHubReturnUrl(`/t/${tenantId}/connections`)}
        onClear={onClear}
        disconnect
      />
    );
  };

  return (
    <div className="grid gap-3">
      {github.isError && <ProblemBlock error={github.error} onRetry={() => void github.refetch()} />}
      <ConnectionCard mark="GH" name="GitHub" state={summary.state} action={action()}>
        {lines()}
        {!owner && <p className="text-muted-foreground">{OWNER_ONLY}</p>}
      </ConnectionCard>
    </div>
  );
};

const GitHubActionsCard = ({
  tenantId,
  summary,
  owner,
  githubConnected,
}: {
  tenantId: string;
  summary: ConnectionSummary;
  owner: boolean;
  githubConnected: boolean;
}) => {
  const detail = useGitHubActionsConnection(tenantId);
  if (detail.isError) return <ProblemBlock error={detail.error} onRetry={() => void detail.refetch()} />;
  const connection = detail.data?.link.state === "Connected" ? detail.data.link.connection : null;
  const action = () => {
    if (!owner) return null;
    if (summary.state === "Connected") return hashLink("disconnect-github-actions", "Disconnect", "destructive");
    if (summary.state === "NotConnected" && githubConnected)
      return hashLink("connect-github-actions", "Connect", "default");
    return null;
  };
  const lines = () => {
    if (summary.state === "Connected") {
      return (
        <>
          <p>
            Bills: <span className="font-medium">{summary.account}</span>
            {connection !== null && `, linked ${dateOf(connection.createdAt)}`}.
          </p>
          <p>Dispatch: workflow_dispatch through the GitHub App installation.</p>
          <p>Job identity: GitHub's OIDC token, exchanged for upload URLs.</p>
          {detail.isPending && <Skeleton className="h-24 w-full" />}
          {connection !== null && (
            <div className="mt-2 grid gap-2">
              <p className="font-medium">Caller workflow each repository holds</p>
              <CopyValues values={[{ name: "Path", value: connection.callerWorkflow }]} />
            </div>
          )}
        </>
      );
    }
    if (summary.state === "NotConfigured") {
      return (
        <p>This stage cannot dispatch GitHub Actions prebuilds yet. Ask the stage operator to finish its setup.</p>
      );
    }
    return (
      <>
        <p>
          {githubConnected
            ? "Dispatches prebuilds through the GitHub App installation."
            : "Needs the GitHub connection first: connect GitHub above."}
        </p>
        <p className="text-muted-foreground">Bills: the GitHub account that owns each repository.</p>
      </>
    );
  };
  return (
    <ConnectionCard mark="GA" name="GitHub Actions" state={summary.state} action={action()}>
      {lines()}
      {!owner && <p className="text-muted-foreground">{OWNER_ONLY}</p>}
    </ConnectionCard>
  );
};

const CircleCIProjects = ({ tenantId }: { tenantId: string }) => {
  const projects = useCircleCIProjects(tenantId);
  if (projects.isPending) return <Skeleton className="h-4 w-64" />;
  if (projects.isError) return <ProblemBlock error={projects.error} onRetry={() => void projects.refetch()} />;
  if (projects.data.length === 0) {
    return (
      <p className="text-muted-foreground">No repository is bound yet. Bind one with tumpel circleci project add.</p>
    );
  }
  return (
    <ul aria-label="Bound repositories">
      {projects.data.map((project) => (
        <li key={project.circleCIProjectId} className="flex flex-wrap gap-2 border-t py-2 first:border-t-0">
          <span className="font-medium">{repositoryLabel(project.repository)}</span>
          <span className="text-muted-foreground">{project.projectSlug}</span>
        </li>
      ))}
    </ul>
  );
};

const CircleCICard = ({
  tenantId,
  summary,
  owner,
}: {
  tenantId: string;
  summary: ConnectionSummary;
  owner: boolean;
}) => {
  const detail = useCircleCIConnection(tenantId);
  if (detail.isError) return <ProblemBlock error={detail.error} onRetry={() => void detail.refetch()} />;
  const link = detail.data?.link;
  const action = () => {
    if (!owner) return null;
    if (summary.state === "Expired") return hashLink("connect-circleci", "Reconnect", "default");
    if (summary.state === "Expiring") {
      return (
        <div className="flex flex-wrap gap-2">
          {hashLink("connect-circleci", "Renew", "default")}
          {hashLink("disconnect-circleci", "Disconnect", "destructive")}
        </div>
      );
    }
    if (summary.state === "Connected") return hashLink("disconnect-circleci", "Disconnect", "destructive");
    if (summary.state === "NotConnected") return hashLink("connect-circleci", "Connect", "default");
    return null;
  };
  const standing = () => {
    if (summary.state === "Expiring") {
      return (
        <p role="status" className="font-medium">
          The CircleCI token stops working on {expiryDate(summary.expiresAt)}. Renew it before then; renewing keeps the
          bound repositories.
        </p>
      );
    }
    if (summary.state === "Expired") {
      return (
        <p role="alert" className="font-medium text-destructive">
          The CircleCI token stopped working on {expiryDate(summary.expiredAt)}. CircleCI prebuilds fail until you
          reconnect; the bound repositories stay.
        </p>
      );
    }
    return null;
  };
  const lines = () => {
    if (link?.state === "Connected" && detail.data !== undefined) {
      const { connection } = link;
      return (
        <>
          {standing()}
          <p>
            Bills: CircleCI organization <span className="font-medium">{connection.accountLabel}</span>, linked{" "}
            {dateOf(connection.createdAt)}
            {connection.credential.kind === "Authorized"
              ? `, token until ${expiryDate(connection.credential.expiresAt)}.`
              : ", with a pasted token."}
          </p>
          <p>Dispatch: the pipeline run API with your CircleCI token, per bound repository.</p>
          <p>Job identity: a token of the organization's OIDC issuer, exchanged for upload URLs.</p>
          <CircleCIProjects tenantId={tenantId} />
          <div className="mt-2 grid gap-2">
            <CopyValues
              values={[
                { name: "Organization", value: connection.organizationId },
                { name: "Issuer", value: connection.issuer },
                { name: "Orb", value: detail.data.orb },
              ]}
            />
          </div>
        </>
      );
    }
    if (summary.state === "Connected" || summary.state === "Expiring" || summary.state === "Expired") {
      return (
        <>
          {standing()}
          <p>Bills: {summary.account}.</p>
        </>
      );
    }
    return (
      <>
        <p>Runs prebuilds on your CircleCI organization, with a config that imports the orb tumpel/prebuild.</p>
        {detail.isPending && <Skeleton className="h-4 w-64" />}
      </>
    );
  };
  return (
    <ConnectionCard mark="CI" name="CircleCI" state={summary.state} action={action()}>
      {lines()}
      {!owner && <p className="text-muted-foreground">{OWNER_ONLY}</p>}
    </ConnectionCard>
  );
};

const NamespaceCard = ({
  tenantId,
  summary,
  owner,
}: {
  tenantId: string;
  summary: ConnectionSummary;
  owner: boolean;
}) => {
  const detail = useNamespaceConnection(tenantId);
  if (detail.isError) return <ProblemBlock error={detail.error} onRetry={() => void detail.refetch()} />;
  const link = detail.data?.link;
  const action = () => {
    if (!owner) return null;
    if (summary.state === "Connected") return hashLink("disconnect-namespace", "Disconnect", "destructive");
    if (summary.state === "NotConnected") return hashLink("connect-namespace", "Connect", "default");
    return null;
  };
  const lines = () => {
    if (link?.state === "Connected") {
      return (
        <>
          <p>
            Bills: Namespace workspace <span className="font-medium">{link.connection.accountLabel}</span>, linked{" "}
            {dateOf(link.connection.createdAt)}.
          </p>
          <p>Remote BuildKit. Namespace trusts Tumpel's OIDC tokens.</p>
          <div className="mt-2 grid gap-2">
            <p className="font-medium">Trust material in your Namespace workspace</p>
            <CopyValues
              values={[
                { name: "Workspace", value: link.connection.workspaceId },
                { name: "Issuer", value: link.connection.issuer },
                { name: "Subject", value: link.connection.subjectPattern },
                { name: "Audience", value: link.connection.audience },
              ]}
            />
          </div>
        </>
      );
    }
    if (link?.state === "NotConfigured") {
      return (
        <>
          <p>{link.detail}</p>
          <p className="text-muted-foreground">{link.fix}</p>
        </>
      );
    }
    if (summary.state === "Connected") return <p>Bills: {summary.account}.</p>;
    return (
      <>
        <p>
          Remote BuildKit on your Namespace account. Namespace trusts Tumpel's OIDC issuer once Namespace Support
          registers it.
        </p>
        {detail.isPending && <Skeleton className="h-4 w-64" />}
      </>
    );
  };
  return (
    <ConnectionCard mark="NS" name="Namespace" state={summary.state} action={action()}>
      {lines()}
      {!owner && <p className="text-muted-foreground">{OWNER_ONLY}</p>}
    </ConnectionCard>
  );
};

const OpenRouterCard = ({ tenantId, summary }: { tenantId: string; summary: ConnectionSummary }) => (
  <ConnectionCard
    mark="OR"
    name="OpenRouter"
    state={summary.state}
    action={
      <Button asChild variant={summary.state === "Connected" ? "outline" : "default"} size="sm">
        <Link to="/t/$tenantId/secrets" params={{ tenantId }}>
          {summary.state === "Connected" ? "Open secret sets" : "Connect from a secret set"}
        </Link>
      </Button>
    }
  >
    {summary.state === "Connected" ? (
      <p>
        OPENROUTER_API_KEY in: <span className="font-medium">{summary.account}</span>.
      </p>
    ) : (
      <p>No secret set holds an OpenRouter key. Open a secret set and choose Connect OpenRouter.</p>
    )}
    <p className="text-muted-foreground">
      OpenCode personas reach OpenRouter's models with the key of their secret set.
    </p>
  </ConnectionCard>
);

export const ConnectionsScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/connections" });
  const search = useSearch({ from: "/t/$tenantId/connections" });
  const navigate = useNavigate();
  const returned = gitHubReturnOf(search);
  const clearReturn = () => void navigate({ to: ".", search: {}, replace: true });
  const connections = useConnections(tenantId);
  const installations = useGitHubInstallations(tenantId);
  const owner = useOwner(tenantId);
  const kind = (wanted: ConnectionSummary["kind"]) => connections.data?.find((row) => row.kind === wanted);
  const body = () => {
    if (connections.isPending) {
      return (
        <div className="grid gap-3">
          <CardSkeleton />
          <h2 className="mt-4 text-[15px] font-semibold">Build providers</h2>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      );
    }
    if (connections.isError) {
      return <ProblemBlock error={connections.error} onRetry={() => void connections.refetch()} />;
    }
    const gitHub = kind("GitHub");
    const gitHubActions = kind("GitHubActions");
    const circleCI = kind("CircleCI");
    const namespace = kind("Namespace");
    const openRouter = kind("OpenRouter");
    return (
      <div className="grid gap-3">
        {gitHub !== undefined && (
          <GitHubCard tenantId={tenantId} summary={gitHub} owner={owner} returned={returned} onClear={clearReturn} />
        )}
        <div id="providers" className="mt-4 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[15px] font-semibold">Build providers</h2>
          <p className="text-sm text-muted-foreground">
            Prebuilds run on the tenant's own provider account. Tumpel runs no build.
          </p>
        </div>
        {gitHubActions !== undefined && (
          <GitHubActionsCard
            tenantId={tenantId}
            summary={gitHubActions}
            owner={owner}
            githubConnected={gitHub?.state === "Connected"}
          />
        )}
        {circleCI !== undefined && <CircleCICard tenantId={tenantId} summary={circleCI} owner={owner} />}
        {namespace !== undefined && <NamespaceCard tenantId={tenantId} summary={namespace} owner={owner} />}
        {openRouter !== undefined && (
          <>
            <h2 className="mt-4 text-[15px] font-semibold">Model providers</h2>
            <OpenRouterCard tenantId={tenantId} summary={openRouter} />
          </>
        )}
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Connections" />
      {body()}
      <GitHubDisconnectDialog tenantId={tenantId} installations={installations.data ?? []} />
      <GitHubActionsConnectDialog tenantId={tenantId} githubLogin={installations.data?.[0]?.accountLogin ?? null} />
      <CircleCIConnectDialog tenantId={tenantId} />
      <NamespaceConnectDialog tenantId={tenantId} />
      <ProviderDisconnectDialog tenantId={tenantId} provider="GitHubActions" />
      <ProviderDisconnectDialog tenantId={tenantId} provider="CircleCI" />
      <ProviderDisconnectDialog tenantId={tenantId} provider="Namespace" />
    </>
  );
};
