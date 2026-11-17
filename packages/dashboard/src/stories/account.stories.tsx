import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, never, StoryApp, tenantPath, unreachable } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Account/Account", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/account") } };

export const Loading: Story = {
  args: { path: tenantPath("/account"), api: fakeApi({ whoami: never, listDevices: never }) },
};

export const NoDevices: Story = {
  args: { path: tenantPath("/account"), api: fakeApi({ listDevices: async () => [] }) },
};

const DevicesError: Story = {
  args: {
    path: tenantPath("/account"),
    api: fakeApi({ listDevices: () => Promise.reject(unreachable("Devices_list")) }),
  },
};

export { DevicesError as Error };
