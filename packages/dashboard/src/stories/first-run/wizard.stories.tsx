import type { Meta, StoryObj } from "@storybook/react-vite";
import { never, StoryApp, signedOutFailure } from "../harness";
import { nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/Wizard", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Loading: Story = {
  args: {
    path: setupPath("github"),
    api: nothingDone({
      whoami: never,
      getGitHubConnection: never,
      listGitHubInstallations: never,
      listHosts: never,
      listOAuthGrants: never,
      listPersonas: never,
      listSecretSets: never,
      listHarnessCatalog: never,
    }),
  },
};

export const SignedOut: Story = {
  args: { path: setupPath("host"), api: nothingDone({ listOAuthGrants: () => Promise.reject(signedOutFailure) }) },
};
