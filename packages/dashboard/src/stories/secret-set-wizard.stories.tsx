import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, within } from "storybook/test";
import { codexDeviceCode, codexSettled, startCodexSignIn } from "./claude-setup-fixtures";
import { fakeApi, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/Wizard", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const add = (secretSetId: string, secret?: string) =>
  tenantPath(`/secrets/${secretSetId}/add${secret === undefined ? "" : `?secret=${secret}`}`);

const choose = async (canvasElement: HTMLElement, label: string, value: string) => {
  const field = await within(canvasElement).findByLabelText(label, undefined, { timeout: 5000 });
  fireEvent.change(field, { target: { value } });
};

export const Name: Story = { args: { path: tenantPath("/secrets/new"), api: fakeApi({}) } };

export const Choose: Story = { args: { path: add("sst_placeholder03"), api: fakeApi({}) } };

export const PlainStart: Story = { args: { path: add("sst_placeholder03", "Plain"), api: fakeApi({}) } };

export const PlainProviderChosen: Story = {
  args: { path: add("sst_placeholder03", "Plain"), api: fakeApi({}) },
  play: async ({ canvasElement }) => choose(canvasElement, "For", "Anthropic"),
};

export const PlainTokenReplacing: Story = {
  args: { path: add("sst_placeholder01", "Plain"), api: fakeApi({}) },
  play: async ({ canvasElement }) => {
    await choose(canvasElement, "For", "Anthropic");
    await choose(canvasElement, "Type", "SubscriptionToken");
    await choose(canvasElement, "Subscription token", "placeholder-token");
    await choose(canvasElement, "Expires", "2027-11-15T09:00");
  },
};

export const PlainVariable: Story = {
  args: { path: add("sst_placeholder03", "Plain"), api: fakeApi({}) },
  play: async ({ canvasElement }) => {
    await choose(canvasElement, "For", "Variable");
    await choose(canvasElement, "Variable name", "NPM_TOKEN");
  },
};

export const OpenRouter: Story = { args: { path: add("sst_placeholder03", "OpenRouter"), api: fakeApi({}) } };

export const Codex: Story = { args: { path: add("sst_placeholder03", "Codex"), api: fakeApi({}) } };

export const CodexDeviceCode: Story = {
  args: { path: add("sst_placeholder03", "Codex"), api: fakeApi(codexSettled(codexDeviceCode)) },
  play: startCodexSignIn,
};
