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

export const Reused: Story = { args: { path: at("build") }, play: submit("Build now") };

export const BuildProviderUnavailable: Story = {
  args: {
    path: at("rebuild"),
    api: fakeApi({
      startPrebuild: () =>
        Promise.reject(
          problem(
            503,
            "BuildProviderUnavailable",
            "GitHub Actions cannot take prebuilds yet",
            "This control plane cannot dispatch to GitHub Actions.",
            "Pick another connected provider, or ask the stage operator when GitHub Actions dispatch lands.",
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
            "GitHub Actions is not connected",
            "The tenant has no GitHub Actions connection.",
            "Connect GitHub Actions on Connections, then rebuild.",
          ),
        ),
    }),
  },
  play: submit("Rebuild"),
};
