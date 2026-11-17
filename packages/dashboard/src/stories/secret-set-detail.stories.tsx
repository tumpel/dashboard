import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/SecretSetDetail", component: StoryApp };
export default meta;

export const Expired: StoryObj<typeof StoryApp> = { args: { path: tenantPath("/secrets/sst_placeholder01") } };
