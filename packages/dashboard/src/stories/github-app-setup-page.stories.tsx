import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  appBadOrganizationPage,
  appCreatedPage,
  appExistsPage,
  appGitHubRefusedPage,
  appNothingToCreatePage,
  appRequestRefusedPage,
  appSetupPage,
} from "@tumpel/pages";
import { LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/GitHubAppSetupPage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

const SETUP = "/github/app/setup";
const CREATED = "/github/app/created?code=placeholder&state=placeholder";
const APP_URL = "https://github.com/apps/app-slug";

export const Setup: Story = {
  args: {
    page: appSetupPage(LINKS, WHO, {
      manifest: { name: "app-slug" },
      action: "https://github.com/settings/apps/new?state=placeholder",
      organization: "",
    }),
    path: SETUP,
  },
};

export const NotAnOrganization: Story = {
  args: { page: appBadOrganizationPage(LINKS, WHO, "example org!"), path: `${SETUP}?organization=example+org!` },
};

export const AlreadySetUp: Story = { args: { page: appExistsPage(LINKS, WHO, "app-slug", APP_URL), path: SETUP } };

export const Created: Story = { args: { page: appCreatedPage(LINKS, WHO, "app-slug", APP_URL), path: CREATED } };

export const NothingToCreate: Story = {
  args: { page: appNothingToCreatePage(LINKS, WHO), path: "/github/app/created" },
};

export const RequestRefused: Story = {
  args: {
    page: appRequestRefusedPage(
      LINKS,
      WHO,
      `The App setup was started by other@example.com, and you are signed in as ${WHO}.`,
    ),
    path: CREATED,
  },
};

export const GitHubRefused: Story = {
  args: {
    page: appGitHubRefusedPage(LINKS, WHO, "GitHub answered 422 to the manifest conversion"),
    path: CREATED,
  },
};
