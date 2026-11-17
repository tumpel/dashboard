import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, fakeAuth, StoryApp, TENANT_ID, tenantPath, unreachable } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Shell/TenantSwitcher", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const twoSignedIn = fakeAuth({
  signedInTenants: () => [
    { tenantId: TENANT_ID, tenantName: "Tenant name", email: "user@example.com" },
    { tenantId: "tnt_placeholder02", tenantName: "Second tenant", email: "user@example.com" },
  ],
});

const openSwitcher = async (canvasElement: HTMLElement) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: /Tenant name/ }));
};

export const Open: Story = {
  args: { path: tenantPath("/overview"), auth: twoSignedIn },
  play: ({ canvasElement }) => openSwitcher(canvasElement),
};

export const Switching: Story = {
  args: { path: tenantPath("/members"), auth: twoSignedIn },
  play: async ({ canvasElement }) => {
    await openSwitcher(canvasElement);
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: /Third tenant/ }));
  },
};

const ListError: Story = {
  args: {
    path: tenantPath("/overview"),
    api: fakeApi({ listTenants: () => Promise.reject(unreachable("Identity_listTenants")) }),
  },
  play: ({ canvasElement }) => openSwitcher(canvasElement),
};

export { ListError as Error };
