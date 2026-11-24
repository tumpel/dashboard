import type { Meta, StoryObj } from "@storybook/react-vite";
import { createHttpApi } from "../api/http";
import { ApiFailure } from "../api/port";
import { REPO } from "./connection-fixtures";
import { fakeApi, memberWhoami, never, StoryApp, signedOutFailure, TENANT_ID, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/PrebuildList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/prebuilds");

export const Default: Story = { args: { path: tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}`) } };

export const ControlPlaneShaped: Story = {
  args: { path },
  render: (args) => {
    const api = createHttpApi(window.location.origin, TENANT_ID, async () => ({ kind: "Token", token: "storybook" }));
    return <StoryApp {...args} api={fakeApi({ listLatestPrebuilds: api.listLatestPrebuilds })} />;
  },
};

export const Loading: Story = {
  args: { path, api: fakeApi({ listLatestPrebuilds: never }) },
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
  args: { path, api: fakeApi({ listLatestPrebuilds: () => Promise.reject(signedOutFailure) }) },
};
