import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Sessions/SessionList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/sessions") } };

export const Loading: Story = {
  args: { path: tenantPath("/sessions"), api: fakeApi({ listSessions: never, listHosts: never, listPersonas: never }) },
};

export const Empty: Story = {
  args: { path: tenantPath("/sessions"), api: fakeApi({ listSessions: async () => [] }) },
};

const ListError: Story = {
  args: {
    path: tenantPath("/sessions"),
    api: fakeApi({
      listSessions: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Sessions did not load",
            "Sessions_list refused the request.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { ListError as Error };
