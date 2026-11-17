import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, StoryApp } from "../harness";
import { allDone, setupPath, THREE_DONE } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/DoneStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const AllDone: Story = { args: { path: setupPath("done"), api: allDone() } };

export const StepsLeft: Story = { args: { path: setupPath("done"), api: fakeApi(THREE_DONE) } };
