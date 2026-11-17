import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, StoryApp, tenantPath } from "../harness";
import { THREE_DONE } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/ResumeSetup", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const StepsLeft: Story = { args: { path: tenantPath("/overview"), api: fakeApi(THREE_DONE) } };
