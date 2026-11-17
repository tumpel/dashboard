import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Hosts/HostList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/hosts") } };

export const Filtered: Story = { args: { path: tenantPath("/hosts?state=Offline") } };

export const Loading: Story = {
  args: { path: tenantPath("/hosts"), api: fakeApi({ listHosts: never, listHostUsage: never }) },
};

export const Empty: Story = {
  args: { path: tenantPath("/hosts"), api: fakeApi({ listHosts: async () => [], listHostUsage: async () => [] }) },
};

const ListError: Story = {
  args: {
    path: tenantPath("/hosts"),
    api: fakeApi({
      listHosts: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Hosts did not load",
            "Hosts_list refused the request.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { ListError as Error };
