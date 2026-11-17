import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, memberWhoami, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Members/InviteMember", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const send = async (email: string) => {
  const dialog = within(await within(document.body).findByRole("dialog"));
  await userEvent.type(await dialog.findByLabelText("Email"), email);
  await userEvent.click(dialog.getByRole("button", { name: "Create invite" }));
};

export const Open: Story = { args: { path: tenantPath("/members#invite") } };

export const Created: Story = {
  args: { path: tenantPath("/members#invite") },
  play: () => send("new-person@example.com"),
};

export const Refused: Story = {
  args: {
    path: tenantPath("/members#invite"),
    api: fakeApi({
      createInvitation: () =>
        Promise.reject(
          problem(
            409,
            "Conflict",
            "Already a member",
            "member@example.com is already a member of your tenant",
            "List the members; invite an email that is not one of them",
          ),
        ),
    }),
  },
  play: () => send("member@example.com"),
};

export const Forbidden: Story = {
  args: {
    path: tenantPath("/members#invite"),
    api: fakeApi({
      whoami: memberWhoami,
      createInvitation: () =>
        Promise.reject(
          problem(
            403,
            "OwnerRequired",
            "Owner only",
            "invitations.create is for an Owner of the tenant, and you are a Member of it",
            "Ask an Owner of the tenant to do it",
          ),
        ),
    }),
  },
  play: () => send("new-person@example.com"),
};
