import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, StoryApp, tenantPath } from "./harness";
import { CATALOG_WITHOUT_SPEND } from "./metric-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Overview/Overview", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/overview");

export const Default: Story = { args: { path } };

export const Loading: Story = {
  args: { path, api: fakeApi({ listHosts: never, listHostUsage: never, listSessions: never }) },
};

export const Empty: Story = {
  args: {
    path,
    api: fakeApi({ listHosts: async () => [], listHostUsage: async () => [], listSessions: async () => [] }),
  },
};

export const TileError: Story = {
  args: {
    path,
    api: fakeApi({
      listSessions: () => Promise.reject(new Error("Sessions_list answered 500 and did not say why.")),
    }),
  },
};

export const NoSpendYet: Story = {
  args: { path, api: fakeApi({ metricCatalog: async () => CATALOG_WITHOUT_SPEND }) },
};

export const MetricsLoading: Story = {
  args: { path, api: fakeApi({ metricCatalog: never }) },
};
