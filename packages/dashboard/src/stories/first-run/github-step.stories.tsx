import type { Meta, StoryObj } from "@storybook/react-vite";
import { GITHUB_APP_MISSING, GITHUB_INSTALLATIONS, GITHUB_READY } from "../connection-fixtures";
import { StoryApp } from "../harness";
import { allDone, nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/GitHubStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Idle: Story = { args: { path: setupPath("github"), api: nothingDone() } };

export const Waiting: Story = { args: { path: setupPath("github", "?from=github"), api: nothingDone() } };

export const Done: Story = { args: { path: setupPath("github"), api: allDone() } };

export const AppMissing: Story = {
  args: {
    path: setupPath("github"),
    api: nothingDone({ getGitHubConnection: async () => GITHUB_APP_MISSING, listGitHubInstallations: async () => [] }),
  },
};

export const AccountList: Story = {
  args: {
    path: setupPath("github"),
    api: nothingDone({
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
    }),
  },
};

export const Refused: Story = {
  args: {
    path: setupPath("github", "?from=github&refused=InstallerUnknown&account=owner-org"),
    api: nothingDone({
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
    }),
  },
};
