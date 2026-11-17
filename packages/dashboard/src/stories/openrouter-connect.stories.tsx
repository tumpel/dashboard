import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, never, StoryApp, tenantPath } from "./harness";
import { DECLINED, openRouterAuthorization } from "./openrouter-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/OpenRouter", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const notConnected = tenantPath("/secrets/sst_placeholder02/add?secret=OpenRouter");
const returned = (secretSetId: string) =>
  tenantPath(`/secrets/${secretSetId}?openRouterAuthorizationId=ora_placeholder01`);

export const NotConnected: Story = { args: { path: notConnected, api: fakeApi({}) } };

export const Authorizing: Story = {
  args: { path: notConnected, api: fakeApi({ authorizeOpenRouter: never }) },
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("button", { name: "Connect OpenRouter" }));
  },
};

export const Connected: Story = { args: { path: returned("sst_placeholder01"), api: fakeApi({}) } };

export const Failed: Story = {
  args: {
    path: returned("sst_placeholder02"),
    api: fakeApi({ getOpenRouterAuthorization: async () => openRouterAuthorization("sst_placeholder02", DECLINED) }),
  },
};
