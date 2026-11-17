import type { Meta, StoryObj } from "@storybook/react-vite";
import { awaitingCode, COMPLETED, FAILURES, MINTING, resumed, settled, startSetup } from "./claude-setup-fixtures";
import { fakeApi, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/ClaudeSetup", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/secrets/sst_placeholder03/add?secret=Anthropic");

export const Idle: Story = { args: { path, api: fakeApi({}) } };

export const ClaudeSetupCode: Story = { args: { path, api: fakeApi(settled(awaitingCode)) }, play: startSetup };

export const ClaudeSetupResumedMinting: Story = { args: { path, api: fakeApi(resumed(() => MINTING)) } };

export const ClaudeSetupTimedOut: Story = {
  args: { path, api: fakeApi(settled(() => FAILURES.MintTimedOut)) },
  play: startSetup,
};

export const ClaudeSetupCompleted: Story = { args: { path, api: fakeApi(settled(() => COMPLETED)) }, play: startSetup };
