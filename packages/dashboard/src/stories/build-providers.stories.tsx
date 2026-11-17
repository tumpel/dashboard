import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { GHA_NOT_CONNECTED, GITHUB_READY, NAMESPACE_CONNECTED, summaries } from "./connection-fixtures";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connections/BuildProviders", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/connections#providers") } };

export const Loading: Story = {
  args: {
    path: tenantPath("/connections#providers"),
    api: fakeApi({ getGitHubActionsConnection: never, getCircleCIConnection: never, getNamespaceConnection: never }),
  },
};

export const GitHubActionsNeedsGitHub: Story = {
  args: {
    path: tenantPath("/connections"),
    api: fakeApi({
      listConnections: async () => summaries("NotConnected", "NotConnected", "NotConnected"),
      getGitHubConnection: async () => GITHUB_READY,
      listGitHubInstallations: async () => [],
      getGitHubActionsConnection: async () => GHA_NOT_CONNECTED,
    }),
  },
};

export const ConnectGitHubActions: Story = {
  args: {
    path: tenantPath("/connections#connect-github-actions"),
    api: fakeApi({
      listConnections: async () => summaries("Connected", "NotConnected", "NotConnected"),
      getGitHubActionsConnection: async () => GHA_NOT_CONNECTED,
    }),
  },
};

export const CircleCIRefused: Story = {
  args: {
    path: tenantPath("/connections#connect-circleci"),
    api: fakeApi({
      startCircleCIConnection: () =>
        Promise.reject(
          problem(
            422,
            "CircleCITokenRefused",
            "CircleCI refused the token",
            "CircleCI answered GET /api/v2/me with 401: Invalid token provided.; the token was not stored",
            "Create a personal API token as a member of the organization, then connect again.",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(await dialog.findByRole("button", { name: "Paste a personal API token instead" }));
    await userEvent.type(
      await dialog.findByLabelText("CircleCI organization id"),
      "6f1c2b3a-0d4e-4f5a-9b8c-7d6e5f4a3b2c",
    );
    await userEvent.type(dialog.getByLabelText("Billing account"), "Acme on CircleCI");
    await userEvent.type(dialog.getByLabelText("Personal API token"), "placeholder-token");
    await userEvent.click(dialog.getByRole("button", { name: "Connect with token" }));
  },
};

export const ConnectNamespace: Story = { args: { path: tenantPath("/connections#connect-namespace") } };

export const NamespaceRefused: Story = {
  args: {
    path: tenantPath("/connections#connect-namespace"),
    api: fakeApi({
      startNamespaceConnection: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Namespace refused Tumpel's token",
            "The issuer is not registered for workspace tenant_placeholder01 yet.",
            "Ask Namespace Support to register the issuer, then connect again.",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.type(await dialog.findByLabelText("Namespace workspace id"), "tenant_placeholder01");
    await userEvent.click(dialog.getByRole("button", { name: "Connect" }));
  },
};

export const NamespaceConnected: Story = {
  args: {
    path: tenantPath("/connections#providers"),
    api: fakeApi({
      listConnections: async () => summaries("Connected", "Connected", "Connected"),
      getNamespaceConnection: async () => NAMESPACE_CONNECTED,
    }),
  },
};

export const DisconnectConfirm: Story = {
  args: {
    path: tenantPath("/connections#disconnect-namespace"),
    api: fakeApi({
      listConnections: async () => summaries("Connected", "Connected", "Connected"),
      getNamespaceConnection: async () => NAMESPACE_CONNECTED,
    }),
  },
};
