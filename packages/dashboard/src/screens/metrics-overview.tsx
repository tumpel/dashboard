import type { MetricsSearch } from "../metrics-search";
import { HarnessStartupCard, OutcomeCard, PhaseCard } from "./metrics-cards";
import { DroppedBanner, HostsTable } from "./metrics-hosts-table";
import { MetricsPage } from "./metrics-page";
import { StatTiles } from "./metrics-tiles";

export const MetricsOverviewScreen = ({ tenantId, search }: { tenantId: string; search: MetricsSearch }) => (
  <MetricsPage tenantId={tenantId} search={search} title="Metrics" path="" filter={[]}>
    {(scope) => (
      <div className="grid gap-4">
        <DroppedBanner scope={scope} />
        <StatTiles scope={scope} />
        <div className="grid gap-4 lg:grid-cols-2">
          <OutcomeCard scope={scope} />
          <HarnessStartupCard scope={scope} />
          <PhaseCard scope={scope} phase="ImageFetch" title="Image fetch time" />
          <PhaseCard scope={scope} phase="FirstOutput" title="Time to first output" />
        </div>
        <HostsTable scope={scope} />
      </div>
    )}
  </MetricsPage>
);
