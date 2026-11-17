import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp, tenantPath } from "./harness";
import { turnId } from "./session-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Sessions/ArchiveSession", component: StoryApp };
export default meta;

export const Confirm: StoryObj<typeof StoryApp> = {
  args: { path: tenantPath(`/sessions/ses_6/turns/${turnId("ses_6", 3)}#archive`) },
};
