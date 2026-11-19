import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, screen, within } from "storybook/test";
import { CONNECTORS } from "./connector-fixtures";
import { fakeApi, memberWhoami, never, problem, StoryApp, tenantPath, unreachable } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connectors/ConnectorList", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const Owner: Story = { args: { path: tenantPath("/connectors") } };

export const Member: Story = { args: { path: tenantPath("/connectors"), api: fakeApi({ whoami: memberWhoami }) } };

export const Loading: Story = { args: { path: tenantPath("/connectors"), api: fakeApi({ listConnectors: never }) } };

export const Empty: Story = {
  args: { path: tenantPath("/connectors"), api: fakeApi({ listConnectors: async () => [] }) },
};

export const EmptyForMember: Story = {
  args: {
    path: tenantPath("/connectors"),
    api: fakeApi({ whoami: memberWhoami, listConnectors: async () => [] }),
  },
};

const ListError: Story = {
  args: {
    path: tenantPath("/connectors"),
    api: fakeApi({
      listConnectors: () => Promise.reject(unreachable("Connectors_list")),
    }),
  },
};

export { ListError as Error };

export const AddStatic: Story = { args: { path: tenantPath("/connectors#add") } };

export const AddRefused: Story = {
  args: {
    path: tenantPath("/connectors#add"),
    api: fakeApi({
      createConnector: () =>
        Promise.reject(
          problem(
            409,
            "Conflict",
            "Connector name taken",
            "another connector of this tenant is named Docs search",
            "Choose another name, or rename the other connector first",
          ),
        ),
    }),
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5000 });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Docs search" } });
    fireEvent.change(within(dialog).getByLabelText("Server address"), {
      target: { value: "https://docs.example.com/mcp" },
    });
    fireEvent.change(within(dialog).getByLabelText("Token"), { target: { value: "placeholder" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
  },
};

export const DeleteInUse: Story = {
  args: {
    path: tenantPath("/connectors"),
    api: fakeApi({
      deleteConnector: () =>
        Promise.reject(
          problem(
            409,
            "ConnectorInUse",
            "Connector in use",
            "connector con_placeholder01 is listed by persona Ticket worker",
            "Remove the connector from those personas, then delete it",
          ),
        ),
    }),
  },
  play: async () => {
    const first = CONNECTORS[0]?.name ?? "";
    fireEvent.pointerDown(await screen.findByRole("button", { name: `More actions for ${first}` }, { timeout: 5000 }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  },
};
