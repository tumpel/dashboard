import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { TumpelApi } from "../api/port";
import { fakeApi, never, problem, StoryApp, signedOutFailure, tenantPath } from "./harness";
import { CATALOG_WITHOUT_SPEND, metricFakes } from "./metric-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Metrics/Metrics", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const BUCKET = "at=2026-11-15T13:00:00%2B01:00";

export const Overview: Story = { args: { path: tenantPath("/metrics") } };

export const OverviewOnAPhone: Story = {
  args: { path: tenantPath("/metrics") },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const OverviewLastWeek: Story = { args: { path: tenantPath("/metrics?range=7d") } };

export const OverviewCustomRange: Story = {
  args: {
    path: tenantPath("/metrics?from=2026-11-14T08:00:00%2B01:00&to=2026-11-14T14:00:00%2B01:00"),
  },
};

export const OutcomePanel: Story = {
  args: { path: tenantPath(`/metrics?metric=turn.end&${BUCKET}&group=outcome:CloneFailed`) },
};

export const Startup: Story = { args: { path: tenantPath("/metrics/startup") } };

export const StartupSplitByStartKind: Story = {
  args: { path: tenantPath("/metrics/startup?split=startKind&stat=p90") },
};

export const StartupWithoutSplit: Story = { args: { path: tenantPath("/metrics/startup?split=none") } };

export const StartupFiltered: Story = {
  args: { path: tenantPath("/metrics/startup?filter=harness:ClaudeCode&filter=startKind:Cold") },
};

export const StartupBucketPanel: Story = {
  args: { path: tenantPath(`/metrics/startup?metric=turn.startup&${BUCKET}&group=harness:ClaudeCode`) },
};

export const StartupBucketPanelOnAPhone: Story = {
  args: { path: tenantPath(`/metrics/startup?metric=turn.startup&${BUCKET}&group=harness:ClaudeCode`) },
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const Hosts: Story = { args: { path: tenantPath("/metrics/hosts") } };

export const Host: Story = { args: { path: tenantPath("/metrics/hosts/hst_placeholder01") } };

export const HostWithDroppedMeasurements: Story = {
  args: { path: tenantPath("/metrics/hosts/hst_placeholder03") },
};

export const Explore: Story = { args: { path: tenantPath("/metrics/explore") } };

export const ExploreGroupedByHarness: Story = {
  args: { path: tenantPath("/metrics/explore?metric=turn.startup&groupBy=harness&stat=p90") },
};

export const ExploreSpendByModel: Story = {
  args: { path: tenantPath("/metrics/explore?metric=turn.cost&range=30d&groupBy=model") },
};

export const ExploreHostCpuByHost: Story = {
  args: { path: tenantPath("/metrics/explore?metric=host.cpu.busy&range=6h&bucket=Hour&groupBy=hostId") },
};

export const Loading: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ queryMetric: never }) },
};

export const CatalogLoading: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ metricCatalog: never }) },
};

const firstDayOnly: TumpelApi["queryMetric"] = (metric, query) => {
  const day = 25 * 3_600_000;
  if (Date.parse(query.to) - Date.parse(query.from) > day) return never();
  return metricFakes().queryMetric(metric, query);
};

export const Refetching: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ queryMetric: firstDayOnly }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Turns ended by outcome");
    await userEvent.click(await canvas.findByRole("button", { name: /Range/ }));
    await userEvent.click(await within(document.body).findByRole("button", { name: "Last 7 days" }));
  },
};

const failing = (detail: string) =>
  problem(
    422,
    "MetricRangeTooLarge",
    "Metric range too large",
    detail,
    "Query from 2026-11-14T14:03:00+01:00 to 2026-11-14T22:23:00+01:00, or pick a larger bucket",
  );

export const OneCardFails: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({
      queryMetric: (metric, query) =>
        metric === "turn.phase"
          ? Promise.reject(failing("the window holds more than 500 Minute buckets"))
          : metricFakes().queryMetric(metric, query),
    }),
  },
};

export const CatalogError: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({ metricCatalog: () => Promise.reject(failing("the catalog could not be read")) }),
  },
};

export const NoMetrics: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ metricCatalog: async () => ({ metrics: [] }) }) },
};

export const MetricMissingFromCatalog: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({
      metricCatalog: async () => ({
        metrics: CATALOG_WITHOUT_SPEND.metrics.filter((item) => !item.metric.startsWith("host.")),
      }),
    }),
  },
};

export const NoPointsUnderFilters: Story = {
  args: {
    path: tenantPath("/metrics/startup?filter=harness:PiDev"),
    api: fakeApi({
      queryMetric: async (metric, query) => ({ metric, unit: "s", bucket: query.bucket, series: [] }),
    }),
  },
};

export const BucketPanelWithoutTurns: Story = {
  args: {
    path: tenantPath(`/metrics/startup?metric=turn.startup&${BUCKET}&group=harness:ClaudeCode`),
    api: fakeApi({
      metricTurns: async () => ({ points: [], cursor: "", finished: true }),
    }),
  },
};

export const SignedOut: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({
      whoami: () => Promise.reject(signedOutFailure),
      metricCatalog: () => Promise.reject(signedOutFailure),
    }),
  },
};
