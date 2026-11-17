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
import { formatTime } from "../fleet";
import { type GitHubReturn, gitHubReturnOf, gitHubReturnUrl } from "../github-return";
import {
  useConnections,
  useGitHubConnection,
  useGitHubInstallations,
  useNamespaceConnection,
  useOwner,
} from "../queries";
import {
  type ConnectionHash,
  GitHubDisconnectDialog,
  NamespaceConnectDialog,
  NamespaceDisconnectDialog,
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
        </div>
      );
    }
    if (connections.isError) {
      return <ProblemBlock error={connections.error} onRetry={() => void connections.refetch()} />;
    }
    const gitHub = kind("GitHub");
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
      <NamespaceConnectDialog tenantId={tenantId} />
      <NamespaceDisconnectDialog tenantId={tenantId} />
    </>
  );
};
