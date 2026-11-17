import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Members/RevokeInvitation", component: StoryApp };
export default meta;

export const Confirm: StoryObj<typeof StoryApp> = {
  args: { path: tenantPath("/members") },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Revoke" }));
  },
};
