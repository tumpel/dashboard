import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { notifyUpdate } from "../shell/app-shell";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Shell/Toast", component: StoryApp };
export default meta;

export const Success: StoryObj<typeof StoryApp> = {
  args: { path: tenantPath("/hosts") },
  play: async () => {
    toast("host-a revoked. Its connection is closed.");
  },
};

export const UpdateNotice: StoryObj<typeof StoryApp> = {
  args: { path: tenantPath("/sessions") },
  play: async () => {
    notifyUpdate(["StateFromANewerControlPlane"]);
  },
};
