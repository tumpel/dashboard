import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ApiFailure } from "../api/port";
import {
  GHA_NOT_CONNECTED,
  GITHUB_APP_MISSING,
  GITHUB_INSTALLATIONS,
  GITHUB_READY,
  summaries,
} from "./connection-fixtures";
import { fakeApi, memberWhoami, never, problem, StoryApp, signedOutFailure, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connections/ConnectionList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/connections");

export const Connected: Story = {
  args: {
    path,
    api: fakeApi({
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
    }),
  },
};

export const NotConnected: Story = {
  args: {
    path,
    api: fakeApi({
      listConnections: async () => summaries("NotConnected", "NotConnected", "NotConnected"),
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => [],
      getGitHubActionsConnection: async () => GHA_NOT_CONNECTED,
    }),
  },
};

export const NotConfigured: Story = {
  args: {
    path,
    api: fakeApi({
      listConnections: async () => summaries("NotConfigured", "NotConnected", "NotConnected"),
      getGitHubConnection: async () => GITHUB_APP_MISSING,
      listGitHubInstallations: async () => [],
      getGitHubActionsConnection: async () => GHA_NOT_CONNECTED,
    }),
  },
};

export const MemberView: Story = {
  args: {
    path,
    api: fakeApi({
      whoami: memberWhoami,
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
    }),
  },
};

export const Loading: Story = {
  args: {
    path,
    api: fakeApi({
      listConnections: never,
      getGitHubConnection: never,
      listGitHubInstallations: never,
      getGitHubActionsConnection: never,
      getNamespaceConnection: never,
    }),
  },
};

const ListError: Story = {
  args: {
    path,
    api: fakeApi({
      listConnections: () =>
        Promise.reject(
          new ApiFailure({
            kind: "Unexpected",
            status: 500,
            detail: "Connections_list answered 500 and did not say why.",
          }),
        ),
    }),
  },
};

export { ListError as Error };

export const SignedOut: Story = {
  args: { path, api: fakeApi({ listConnections: () => Promise.reject(signedOutFailure) }) },
};

const githubReady = {
  listConnections: async () => summaries("Connected", "NotConnected", "NotConnected"),
  getGitHubConnection: async () => GITHUB_READY,
  listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
  getGitHubActionsConnection: async () => GHA_NOT_CONNECTED,
};

const startedWith: (number | null)[] = [];

export const AddNew: Story = {
  args: {
    path,
    api: fakeApi({
      ...githubReady,
      startGitHubConnection: (_returnUrl, gitHubAccountId) => {
        startedWith.push(gitHubAccountId);
        return never();
      },
    }),
  },
  play: async () => {
    const screen = within(document.body);
    await userEvent.click(await screen.findByRole("button", { name: "Add new" }));
    await expect(await screen.findByRole("button", { name: "Opening GitHub..." })).toBeDisabled();
    await expect(startedWith.at(-1)).toBeNull();
  },
};

export const AddNewRefused: Story = {
  args: {
    path,
    api: fakeApi({
      ...githubReady,
      startGitHubConnection: () =>
        Promise.reject(
          problem(
            409,
            "GitHubAppMissing",
            "This stage has no GitHub App",
            "The control plane has no GitHub App to install.",
            "The stage's operator creates the App once at the setup URL.",
          ),
        ),
    }),
  },
  play: async () => {
    const screen = within(document.body);
    await userEvent.click(await screen.findByRole("button", { name: "Add new" }));
    await screen.findByText("This stage has no GitHub App");
  },
};

export const RefusedOtherTenant: Story = {
  args: { path: `${path}?from=github&refused=OtherTenant&account=owner-org`, api: fakeApi(githubReady) },
};

export const RefusedNotInstaller: Story = {
  args: { path: `${path}?from=github&refused=NotInstaller&account=owner-org`, api: fakeApi(githubReady) },
};

export const ReturnFailed: Story = {
  args: {
    path: `${path}?from=github&failed=${encodeURIComponent("GitHub answered 502 for the installations you can access")}`,
    api: fakeApi(githubReady),
  },
};

export const InstallationsLoading: Story = {
  args: { path, api: fakeApi({ ...githubReady, listGitHubInstallations: never }) },
};

export const InstallationsError: Story = {
  args: {
    path,
    api: fakeApi({
      ...githubReady,
      listGitHubInstallations: () =>
        Promise.reject(
          new ApiFailure({
            kind: "Unexpected",
            status: 500,
            detail: "GitHubConnections_list answered 500 and did not say why.",
          }),
        ),
    }),
  },
};
