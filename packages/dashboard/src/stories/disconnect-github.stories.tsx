import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connections/DisconnectGitHub", component: StoryApp };
export default meta;

export const Confirm: StoryObj<typeof StoryApp> = {
  args: { path: tenantPath("/connections#disconnect-github-41000001") },
};
