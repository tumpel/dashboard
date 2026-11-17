import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { StoryApp, unreachable } from "../harness";
import { allDone, nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/ClaudeStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = setupPath("claude");

export const Idle: Story = { args: { path, api: nothingDone() } };

export const Waiting: Story = {
  args: { path, api: nothingDone() },
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("button", { name: "Copy URL" }));
  },
};

export const Done: Story = { args: { path, api: allDone() } };

export const ReadFailed: Story = {
  args: { path, api: nothingDone({ listOAuthGrants: () => Promise.reject(unreachable("OAuthGrants_list")) }) },
};
