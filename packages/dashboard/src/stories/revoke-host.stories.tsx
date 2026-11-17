import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Hosts/RevokeHost", component: StoryApp };
export default meta;

export const Confirm: StoryObj<typeof StoryApp> = { args: { path: tenantPath("/hosts/hst_placeholder01#revoke") } };
