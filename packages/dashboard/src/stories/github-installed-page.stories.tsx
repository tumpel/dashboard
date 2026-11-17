import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  gitHubConnectedPage,
  installationChoicePage,
  installationInUsePage,
  installationRequestedPage,
  installerUnconfirmedPage,
  installNothingToConnectPage,
  installRefusedPage,
  noGitHubAppPage,
  notTheInstallerPage,
} from "@tumpel/pages";
import { LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/GitHubInstalledPage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

const PATH = "/github/app/installed";
const TENANT_ID = "tnt_placeholder01";

export const Connected: Story = {
  args: {
    page: gitHubConnectedPage(LINKS, WHO, {
      tenantId: TENANT_ID,
      accountLogin: "example-org",
      settingsUrl: "https://github.com/settings/installations/1234",
    }),
    path: PATH,
  },
};

export const InstallationRequested: Story = {
  args: { page: installationRequestedPage(LINKS, WHO, TENANT_ID), path: `${PATH}?setup_action=request` },
};

export const ConfirmInstallation: Story = {
  args: {
    page: installationChoicePage(LINKS, {
      email: WHO,
      accountLogin: "example-org",
      action: PATH,
      choice: "placeholder",
      tenants: [
        { tenantId: TENANT_ID, name: "Tenant name" },
        { tenantId: "tnt_placeholder02", name: "Other tenant" },
      ],
    }),
    path: `${PATH}?code=placeholder&installation_id=1234&setup_action=install`,
  },
};

export const NothingToConnect: Story = { args: { page: installNothingToConnectPage(LINKS, WHO), path: PATH } };

export const RequestRefused: Story = {
  args: {
    page: installRefusedPage(
      LINKS,
      WHO,
      null,
      "Request refused",
      "This installation was started by other@example.com, and you are signed in as sender@example.com.",
    ),
    path: PATH,
  },
};

export const NoGitHubApp: Story = { args: { page: noGitHubAppPage(LINKS, WHO, TENANT_ID), path: PATH } };

export const GitHubDidNotConfirm: Story = {
  args: {
    page: installerUnconfirmedPage(LINKS, WHO, TENANT_ID, "GitHub answered 502 to the installer check"),
    path: PATH,
  },
};

export const NotTheInstaller: Story = {
  args: {
    page: notTheInstallerPage(
      LINKS,
      WHO,
      TENANT_ID,
      "GitHub says the account signed in on GitHub cannot reach the installation on example-org",
    ),
    path: PATH,
  },
};

export const InstallationInUse: Story = {
  args: {
    page: installationInUsePage(LINKS, WHO, TENANT_ID, "example-org", "https://github.com/settings/installations/1234"),
    path: PATH,
  },
};
