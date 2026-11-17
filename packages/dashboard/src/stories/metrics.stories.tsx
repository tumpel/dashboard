import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, signedOutFailure, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Metrics/Metrics", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/metrics") } };

export const GroupedByHarness: Story = {
  args: { path: tenantPath("/metrics?metric=turn.startup&groupBy=harness&stat=p90") },
};

export const HostCpuByHost: Story = {
  args: { path: tenantPath("/metrics?metric=host.cpu.busy&range=6h&bucket=Hour&groupBy=hostId") },
};

export const Filtered: Story = {
  args: {
    path: tenantPath("/metrics?metric=turn.phase&groupBy=phase&filter=harness:Codex&filter=outcome:Completed"),
  },
};

export const SpendPerDayByModel: Story = {
  args: { path: tenantPath("/metrics?metric=turn.cost&range=30d&groupBy=model") },
};

export const TurnsBehindAPoint: Story = {
  args: {
    path: tenantPath(
      "/metrics?metric=turn.startup&groupBy=harness&at=2026-11-15T13:00:00%2B01:00&group=harness:ClaudeCode",
    ),
  },
};

export const Loading: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ metricCatalog: never }) },
};

export const NoMetrics: Story = {
  args: { path: tenantPath("/metrics"), api: fakeApi({ metricCatalog: async () => ({ metrics: [] }) }) },
};

export const NoPoints: Story = {
  args: {
    path: tenantPath("/metrics?filter=harness:PiDev"),
    api: fakeApi({
      queryMetric: async (metric, query) => ({ metric, unit: "s", bucket: query.bucket, series: [] }),
    }),
  },
};

const QueryError: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({
      queryMetric: () =>
        Promise.reject(
          problem(
            422,
            "MetricRangeTooLarge",
            "Metric range too large",
            "the window from 2026-11-14T14:03:00+01:00 to 2026-11-15T14:03:00+01:00 holds more than 500 Minute buckets",
            "Query from 2026-11-14T14:03:00+01:00 to 2026-11-14T22:23:00+01:00, or pick a larger bucket",
          ),
        ),
    }),
  },
};

export { QueryError as Error };

export const SignedOut: Story = {
  args: {
    path: tenantPath("/metrics"),
    api: fakeApi({
      whoami: () => Promise.reject(signedOutFailure),
      metricCatalog: () => Promise.reject(signedOutFailure),
    }),
  },
};
