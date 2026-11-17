import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryApp } from "../harness";
import { nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/TenantStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Done: Story = { args: { path: setupPath("tenant"), api: nothingDone() } };
