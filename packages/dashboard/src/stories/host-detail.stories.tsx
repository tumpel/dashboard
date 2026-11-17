import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Hosts/HostDetail", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/hosts/hst_placeholder01") } };

export const UpdateFailed: Story = { args: { path: tenantPath("/hosts/hst_placeholder02") } };

export const NoReport: Story = { args: { path: tenantPath("/hosts/hst_placeholder04") } };

export const Revoked: Story = { args: { path: tenantPath("/hosts/hst_placeholder05") } };
