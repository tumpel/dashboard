import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import {
  awaitingCode,
  COMPLETED,
  enterCode,
  FAILURES,
  MINTING,
  resumed,
  STARTING,
  settled,
  startSetup,
} from "../claude-setup-fixtures";
import { GITHUB_INSTALLATIONS, GITHUB_READY } from "../connection-fixtures";
import { never, problem, StoryApp, unreachable } from "../harness";
import { allDone, nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/PersonaStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = setupPath("persona");

const connected = {
  getGitHubConnection: async () => GITHUB_READY,
  listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
};

const saveToken = async () => {
  const screen = within(document.body);
  await userEvent.type(await screen.findByLabelText("Claude token"), "sk-ant-oat01-placeholder");
  await userEvent.click(await screen.findByRole("button", { name: "Save persona" }));
};

export const Idle: Story = { args: { path, api: nothingDone(connected) } };

export const IdleWithGitHubToken: Story = { args: { path, api: nothingDone() } };

export const Saving: Story = {
  args: { path, api: nothingDone({ ...connected, updateSecretSet: never }) },
  play: saveToken,
};

export const Done: Story = { args: { path, api: allDone() } };

export const SaveRefused: Story = {
  args: {
    path,
    api: nothingDone({
      ...connected,
      updateSecretSet: () =>
        Promise.reject(
          problem(
            422,
            "InvalidRequest",
            "Could not save the token",
            "SecretSets_update answered 422: expiresAt must be in the future.",
            "Choose Change, pick a later date, then save again.",
          ),
        ),
    }),
  },
  play: saveToken,
};

const claudeSetupAt = (status: Parameters<typeof settled>[0]): Story => ({
  args: { path, api: nothingDone({ ...connected, ...settled(status) }) },
  play: startSetup,
});

export const ClaudeSetupStartPending: Story = {
  args: { path, api: nothingDone({ ...connected, startClaudeSetup: never }) },
  play: startSetup,
};

export const ClaudeSetupStarting = claudeSetupAt(() => STARTING);

export const ClaudeSetupCode = claudeSetupAt(awaitingCode);

export const ClaudeSetupSending: Story = {
  args: { path, api: nothingDone({ ...connected, ...settled(awaitingCode), submitClaudeSetupCode: never }) },
  play: enterCode,
};

export const ClaudeSetupCodeNotWaiting: Story = {
  args: {
    path,
    api: nothingDone({
      ...connected,
      ...settled(awaitingCode),
      submitClaudeSetupCode: () =>
        Promise.reject(
          problem(
            409,
            "ClaudeSetupNotWaiting",
            "This setup is not waiting for a code",
            "Claude setup cls_placeholder01 reads Failed, not AwaitingCode.",
            "Check again to see the setup, then start a new one.",
          ),
        ),
    }),
  },
  play: enterCode,
};

export const ClaudeSetupMinting = claudeSetupAt(() => MINTING);

export const ClaudeSetupResumedCode: Story = {
  args: { path, api: nothingDone({ ...connected, ...resumed(awaitingCode) }) },
};

export const ClaudeSetupResumedMinting: Story = {
  args: { path, api: nothingDone({ ...connected, ...resumed(() => MINTING) }) },
};

export const ClaudeSetupResumeFailed: Story = {
  args: {
    path,
    api: nothingDone({
      ...connected,
      listClaudeSetups: () => Promise.reject(unreachable("ClaudeSetups_list")),
    }),
  },
};

export const ClaudeSetupCompleted = claudeSetupAt(() => COMPLETED);

export const ClaudeSetupNoHost: Story = {
  args: {
    path,
    api: nothingDone({
      ...connected,
      startClaudeSetup: () =>
        Promise.reject(
          problem(
            409,
            "NoHostOnline",
            "No host can run the setup box",
            "No Online host of this tenant has a free slot and the Claude Code 2.1.4 image for its architecture.",
            "Add a host, or bring an enrolled host online, then try again.",
          ),
        ),
    }),
  },
  play: startSetup,
};

export const ClaudeSetupNoUrl = claudeSetupAt(() => FAILURES.SetupUrlMissing);

export const ClaudeSetupCodeRejected = claudeSetupAt(() => FAILURES.CodeRejected);

export const ClaudeSetupTimedOut = claudeSetupAt(() => FAILURES.SetupTimedOut);

export const ClaudeSetupMintTimedOut = claudeSetupAt(() => FAILURES.MintTimedOut);

export const ClaudeSetupTokenNotStored = claudeSetupAt(() => FAILURES.TokenNotStored);

export const ClaudeSetupSuperseded = claudeSetupAt(() => FAILURES.Superseded);
