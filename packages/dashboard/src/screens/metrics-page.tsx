import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { hostName } from "../fleet";
import type { MetricsSearch } from "../metrics-search";
import { useHosts, useMetricCatalog } from "../queries";
import { BucketPanel } from "./metrics-bucket-panel";
import type { CardScope } from "./metrics-cards";
import { Breadcrumb, FilterRow, type MetricsView, useMetricsView, ViewProvider } from "./metrics-view";

type PageProps = {
  tenantId: string;
  search: MetricsSearch;
  title: string;
  path: "" | "/startup" | "/hosts" | "/explore";
  trail?: string;
  filter: string[];
  controls?: (scope: CardScope) => ReactNode;
  children: (scope: CardScope) => ReactNode;
};

const MetricsPageBody = ({
  view,
  title,
  path,
  trail,
  filter,
  controls,
  children,
}: PageProps & { view: MetricsView }) => {
  const { tenantId } = view;
  const catalog = useMetricCatalog(tenantId, view.window);
  const hosts = useHosts(tenantId);
  const header = (
    <PageHeader
      title={title}
      crumb={<Breadcrumb view={view} path={path} {...(trail === undefined ? {} : { trail })} />}
    />
  );
  if (catalog.isError) {
    return (
      <>
        {header}
        <FilterRow view={view} />
        <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />
      </>
    );
  }
  if (catalog.data === undefined) {
    return (
      <>
        {header}
        <FilterRow view={view} />
        <div aria-busy className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </>
    );
  }
  if (catalog.data.metrics.length === 0) {
    return (
      <>
        {header}
        <FilterRow view={view} />
        <EmptyState
          title="No metrics in this range"
          detail="Hosts report metrics while they run turns. Pick a longer range, or check that a host is online."
          action={
            <Button asChild variant="outline">
              <Link to="/t/$tenantId/hosts" params={{ tenantId }} search={{ state: [] }}>
                Open hosts
              </Link>
            </Button>
          }
        />
      </>
    );
  }
  const scope: CardScope = {
    view,
    catalog: catalog.data,
    filter,
    hostNames: (hostId) => hostName(hosts.data ?? [], hostId),
  };
  return (
    <>
      {header}
      <FilterRow view={view}>{controls?.(scope)}</FilterRow>
      {children(scope)}
      <BucketPanel scope={scope} />
    </>
  );
};

export const MetricsPage = (props: PageProps) => {
  const view = useMetricsView(props.tenantId, props.search);
  return (
    <ViewProvider value={view}>
      <MetricsPageBody {...props} view={view} />
    </ViewProvider>
  );
};
