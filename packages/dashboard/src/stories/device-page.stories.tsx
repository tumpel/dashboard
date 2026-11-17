import type { Meta, StoryObj } from "@storybook/react-vite";
import { codeNotFoundPage, confirmPage, deviceApprovedPage, deviceDeniedPage, enterCodePage } from "@tumpel/pages";
import { contextAt, LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/DevicePage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

const PATH = "/device?code=ABCD-EFGH";
const TENANT = { tenantId: "tnt_placeholder01", name: "Tenant name" };
const request = (tenants: { tenantId: string; name: string }[]) => ({
  email: WHO,
  tenants,
  userCode: "ABCD-EFGH",
  deviceName: "Device name",
});

export const EnterCode: Story = { args: { page: enterCodePage(LINKS, WHO), path: "/device" } };

export const ConfirmOneTenant: Story = {
  args: { page: confirmPage(LINKS, request([TENANT]), contextAt(PATH)), path: PATH },
};

export const ConfirmChooseTenant: Story = {
  args: {
    page: confirmPage(
      LINKS,
      request([TENANT, { tenantId: "tnt_placeholder02", name: "Other tenant" }]),
      contextAt(PATH),
    ),
    path: PATH,
  },
};

export const Approved: Story = { args: { page: deviceApprovedPage(LINKS, WHO, "Device name", TENANT), path: PATH } };

export const Denied: Story = { args: { page: deviceDeniedPage(LINKS, WHO), path: PATH } };

export const CodeNotFound: Story = { args: { page: codeNotFoundPage(LINKS, WHO), path: PATH } };
