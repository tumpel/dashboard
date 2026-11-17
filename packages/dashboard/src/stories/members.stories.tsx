import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, memberWhoami, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Members/MemberList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Owner: Story = { args: { path: tenantPath("/members") } };

export const MemberView: Story = {
  args: { path: tenantPath("/members"), api: fakeApi({ whoami: memberWhoami }) },
};

export const Loading: Story = {
  args: { path: tenantPath("/members"), api: fakeApi({ listMembers: never, listInvitations: never }) },
};

export const NoOpenInvites: Story = {
  args: { path: tenantPath("/members"), api: fakeApi({ listInvitations: async () => [] }) },
};

const ListError: Story = {
  args: {
    path: tenantPath("/members"),
    api: fakeApi({
      listMembers: () =>
        Promise.reject(
          problem(
            500,
            "InvalidRequest",
            "Members did not load",
            "Members_list answered 500.",
            "Retry. If it keeps failing, report it with the time shown.",
          ),
        ),
    }),
  },
};

export { ListError as Error };
