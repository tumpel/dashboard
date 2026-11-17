import type { Meta, StoryObj } from "@storybook/react-vite";
import { acceptPage, invitationExpiredPage, invitationNotFoundPage, invitationOtherEmailPage } from "@tumpel/pages";
import { LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/AcceptPage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

const PATH = "/invitations/accept?token=placeholder";
const INVITATION = {
  email: WHO,
  tenantName: "Tenant name",
  role: "Member",
  token: "placeholder",
  next: LINKS.dashboard,
};

export const Open: Story = { args: { page: acceptPage(LINKS, INVITATION), path: PATH } };

export const Expired: Story = { args: { page: invitationExpiredPage(LINKS, WHO), path: PATH } };

export const OtherEmail: Story = {
  args: { page: invitationOtherEmailPage(LINKS, WHO, "invitee@example.com"), path: PATH },
};

export const NotFound: Story = { args: { page: invitationNotFoundPage(LINKS, WHO), path: PATH } };
