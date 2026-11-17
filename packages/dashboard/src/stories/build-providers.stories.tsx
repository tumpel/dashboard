import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { NAMESPACE_CONNECTED, summaries } from "./connection-fixtures";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connections/BuildProviders", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Default: Story = { args: { path: tenantPath("/connections#providers") } };

export const Loading: Story = {
  args: {
    path: tenantPath("/connections#providers"),
    api: fakeApi({ getNamespaceConnection: never }),
  },
};

export const ConnectNamespace: Story = { args: { path: tenantPath("/connections#connect-namespace") } };

export const NamespaceRefused: Story = {
  args: {
    path: tenantPath("/connections#connect-namespace"),
    api: fakeApi({
      startNamespaceConnection: () =>
        Promise.reject(
          problem(
            400,
            "InvalidRequest",
            "Namespace refused Tumpel's token",
            "The issuer is not registered for workspace tenant_placeholder01 yet.",
            "Ask Namespace Support to register the issuer, then connect again.",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.type(await dialog.findByLabelText("Namespace workspace id"), "tenant_placeholder01");
    await userEvent.click(dialog.getByRole("button", { name: "Connect" }));
  },
};

export const NamespaceConnected: Story = {
  args: {
    path: tenantPath("/connections#providers"),
    api: fakeApi({
      listConnections: async () => summaries("Connected", "Connected"),
      getNamespaceConnection: async () => NAMESPACE_CONNECTED,
    }),
  },
};

export const DisconnectConfirm: Story = {
  args: {
    path: tenantPath("/connections#disconnect-namespace"),
    api: fakeApi({
      listConnections: async () => summaries("Connected", "Connected"),
      getNamespaceConnection: async () => NAMESPACE_CONNECTED,
    }),
  },
};
