import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { TumpelApi } from "../api/port";
import { REPO } from "./connection-fixtures";
import { fakeApi, StoryApp, tenantPath } from "./harness";
import { devcontainerMissing } from "./prebuild-template-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/RebuildPrebuild", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const at = (hash: string) => tenantPath(`/prebuilds?repo=${encodeURIComponent(REPO)}#${hash}`);

export const Open: Story = { args: { path: at("rebuild") } };

const refusedStart = fn<TumpelApi["startPrebuild"]>(() => Promise.reject(devcontainerMissing));

export const DevcontainerMissing: Story = {
  args: {
    path: at("rebuild"),
    api: fakeApi({ startPrebuild: refusedStart }),
  },
  play: async () => {
    const dialog = within(await within(document.body).findByRole("dialog"));
    const rebuild = dialog.getByRole("button", { name: "Rebuild" });
    await waitFor(() => expect(rebuild).toBeEnabled());
    await userEvent.click(rebuild);
    await expect(refusedStart).toHaveBeenCalledWith({
      repository: REPO,
      personaId: "prs_placeholder01",
      rebuild: true,
    });
  },
};
