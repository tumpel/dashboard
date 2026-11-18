import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApiFailure } from "../api/port";
import { REPO, summaries } from "./connection-fixtures";
import { fakeApi, memberWhoami, never, StoryApp, signedOutFailure, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/PrebuildList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/prebuilds");

export const Default: Story = { args: { path: tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}`) } };

export const Loading: Story = {
  args: { path, api: fakeApi({ listConnections: never, listLatestPrebuilds: never }) },
};

export const NoProvider: Story = {
  args: { path, api: fakeApi({ listConnections: async () => summaries("Connected", "NotConnected") }) },
};

export const NoProviderMember: Story = {
  args: {
    path,
    api: fakeApi({
      whoami: memberWhoami,
      listConnections: async () => summaries("Connected", "NotConnected"),
    }),
  },
};

export const NoPrebuildYet: Story = { args: { path, api: fakeApi({ listLatestPrebuilds: async () => [] }) } };

export const RepositoryNoPrebuild: Story = {
  args: { path: tenantPath(`/prebuilds?repo=${encodeURIComponent("https://github.com/owner/new-repo")}`) },
};

export const MemberView: Story = {
  args: { path: tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}`), api: fakeApi({ whoami: memberWhoami }) },
};

const ListError: Story = {
  args: {
    path: tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}`),
    api: fakeApi({
      listLatestPrebuilds: () =>
        Promise.reject(
          new ApiFailure({
            kind: "Unexpected",
            status: 500,
            detail: "Prebuilds_listLatest answered 500 and did not say why.",
          }),
        ),
    }),
  },
};

export { ListError as Error };

export const SignedOut: Story = {
  args: { path, api: fakeApi({ listConnections: () => Promise.reject(signedOutFailure) }) },
};
