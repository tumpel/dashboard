import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";
import { SOLE_OWNER } from "./member-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Members/RemoveMember", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const removeRow = async (canvasElement: HTMLElement, row: number) => {
  const buttons = await within(canvasElement).findAllByRole("button", { name: "Remove" });
  const button = buttons[row];
  if (button === undefined) throw new Error(`The member list has no Remove button at row ${row}`);
  await userEvent.click(button);
};

export const Confirm: Story = {
  args: { path: tenantPath("/members") },
  play: ({ canvasElement }) => removeRow(canvasElement, 2),
};

export const LastOwner: Story = {
  args: {
    path: tenantPath("/members"),
    api: fakeApi({
      listMembers: async () => SOLE_OWNER,
      removeMember: () =>
        Promise.reject(
          problem(
            409,
            "LastOwner",
            "Last Owner",
            "principal prn_placeholder01 is the last Owner of the tenant",
            "Invite another Owner and let them accept first, then remove this one",
          ),
        ),
    }),
  },
  play: async ({ canvasElement }) => {
    await removeRow(canvasElement, 0);
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }));
  },
};
