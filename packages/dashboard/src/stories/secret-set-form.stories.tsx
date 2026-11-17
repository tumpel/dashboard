import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, waitFor, within } from "storybook/test";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/SecretSetForm", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const editPath = tenantPath("/secrets/sst_placeholder01/edit");

const fillValues = (canvasElement: HTMLElement, count: number): void => {
  const fields = Array.from(canvasElement.querySelectorAll<HTMLInputElement>('input[type="password"]')).slice(0, count);
  for (const field of fields) fireEvent.change(field, { target: { value: "placeholder-value" } });
};

export const EditEveryValue: Story = {
  args: { path: editPath },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByLabelText("Value of CLAUDE_CODE_OAUTH_TOKEN", undefined, { timeout: 5000 });
    fillValues(canvasElement, 1);
  },
};

export const ProviderConflict: Story = {
  args: {
    path: editPath,
    api: fakeApi({
      updateSecretSet: () =>
        Promise.reject(
          problem(
            409,
            "Conflict",
            "Second credential for Anthropic",
            "A set holds one credential per provider. CLAUDE_CODE_OAUTH_TOKEN already covers Anthropic.",
            "Remove one of the two, or move ANTHROPIC_API_KEY to another set.",
          ),
        ),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = await canvas.findByLabelText("Name of NPM_TOKEN", undefined, { timeout: 5000 });
    fireEvent.change(name, { target: { value: "ANTHROPIC_API_KEY" } });
    fireEvent.change(await canvas.findByLabelText("Kind of ANTHROPIC_API_KEY"), { target: { value: "ApiKey" } });
    await canvas.findByLabelText("Provider of ANTHROPIC_API_KEY");
    const save = canvas.getByRole("button", { name: "Save" });
    await waitFor(() => {
      if (save.hasAttribute("disabled")) throw new Error("Save is still disabled");
    });
    fireEvent.click(save);
  },
};
