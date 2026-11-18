import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { REPO } from "./connection-fixtures";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/RebuildPrebuild", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const at = (hash: string) => tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}#${hash}`);

const submit = (name: string) => async () => {
  const dialog = within(await within(document.body).findByRole("dialog"));
  await userEvent.click(await dialog.findByRole("button", { name }));
};

export const Open: Story = { args: { path: at("rebuild") } };

export const DevcontainerMissing: Story = {
  args: {
    path: at("rebuild"),
    api: fakeApi({
      startPrebuild: () =>
        Promise.reject(
          problem(
            409,
            "DevcontainerMissing",
            "The repository has no devcontainer.json",
            "owner/repo-name holds neither .devcontainer/devcontainer.json nor .devcontainer.json on its default branch.",
            "Pick a template to add one in a pull request, or commit your own.",
          ),
        ),
    }),
  },
  play: submit("Rebuild"),
};

export const BuildProviderUnavailable: Story = {
  args: {
    path: at("rebuild"),
    api: fakeApi({
      startPrebuild: () =>
        Promise.reject(
          problem(
            503,
            "BuildProviderUnavailable",
            "Namespace cannot take prebuilds yet",
            "This control plane cannot dispatch to Namespace.",
            "Pick another connected provider, or ask the stage operator when Namespace dispatch lands.",
          ),
        ),
    }),
  },
  play: submit("Rebuild"),
};

export const NoBuildProvider: Story = {
  args: {
    path: at("rebuild"),
    api: fakeApi({
      startPrebuild: () =>
        Promise.reject(
          problem(
            409,
            "NoBuildProvider",
            "Namespace is not connected",
            "The tenant has no Namespace connection.",
            "Connect Namespace on Connections, then rebuild.",
          ),
        ),
    }),
  },
  play: submit("Rebuild"),
};
