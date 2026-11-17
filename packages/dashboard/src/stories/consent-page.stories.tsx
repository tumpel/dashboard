import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  alreadyApprovedPage,
  consentPage,
  consentRefusedPage,
  noTenantPage,
  nothingToConnectPage,
  unknownClientPage,
} from "@tumpel/pages";
import { LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/ConsentPage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

const PATH = "/oauth/consent?request=req_placeholder";
const TENANT = { tenantId: "tnt_placeholder01", name: "Tenant name" };
const consent = (tenants: { tenantId: string; name: string }[]) => ({
  email: WHO,
  tenants,
  clientName: "claude.ai",
  callbackOrigin: "https://claude.ai",
  requestId: "req_placeholder",
  csrf: "csrf_placeholder",
});

export const ConnectorOneTenant: Story = { args: { page: consentPage(LINKS, consent([TENANT])), path: PATH } };

export const ChooseTenant: Story = {
  args: {
    page: consentPage(LINKS, consent([TENANT, { tenantId: "tnt_placeholder02", name: "Other tenant" }])),
    path: PATH,
  },
};

const CLIENT = { clientName: "claude.ai", callbackOrigin: "https://claude.ai", returnUrl: "https://claude.ai" };

export const NothingToConnect: Story = { args: { page: nothingToConnectPage(LINKS, WHO, CLIENT), path: PATH } };

export const AlreadyApproved: Story = { args: { page: alreadyApprovedPage(LINKS, WHO, CLIENT), path: PATH } };

export const NothingToConnectUnknownClient: Story = {
  args: { page: nothingToConnectPage(LINKS, WHO, null), path: PATH },
};

export const NoTenant: Story = { args: { page: noTenantPage(LINKS, WHO), path: PATH } };

export const UnknownClient: Story = {
  args: { page: unknownClientPage(LINKS), path: "/oauth/authorize?client_id=unknown" },
};

export const RequestRefused: Story = {
  args: { page: consentRefusedPage(LINKS, WHO, "CrossSite", CLIENT), path: "/oauth/consent" },
};
