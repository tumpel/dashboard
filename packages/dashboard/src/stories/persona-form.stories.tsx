import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, within } from "storybook/test";
import { fakeApi, never, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Personas/PersonaForm", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const editPath = tenantPath("/personas/prs_placeholder01?file=.claude%2FCLAUDE.md");

const typeIntoFile = async (canvasElement: HTMLElement, kib: number): Promise<void> => {
  const editor = await within(canvasElement).findByLabelText(".claude/CLAUDE.md", undefined, { timeout: 5000 });
  fireEvent.change(editor, { target: { value: `# Ticket worker\n${"x".repeat(kib * 1024)}` } });
};

export const Edit: Story = { args: { path: editPath } };

export const Create: Story = { args: { path: tenantPath("/personas/new?harness=ClaudeCode") } };

export const Uploading: Story = {
  args: { path: editPath, api: fakeApi({ uploadPersonaFile: never }) },
  play: async ({ canvasElement }) => {
    await typeIntoFile(canvasElement, 84);
    await within(canvasElement).findByText("85 KiB, Changed");
    fireEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
  },
};

export const TooLarge: Story = {
  args: { path: editPath },
  play: async ({ canvasElement }) => {
    await typeIntoFile(canvasElement, 295);
  },
};
