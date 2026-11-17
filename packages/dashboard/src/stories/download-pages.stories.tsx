import type { Meta, StoryObj } from "@storybook/react-vite";
import { noBuildPage, noReleasePage } from "@tumpel/pages";
import { LINKS, ServerPage } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/DownloadPages", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

export const NoRelease: Story = {
  args: { page: noReleasePage(LINKS, `${LINKS.api}/v1/releases/cli/Amd64`), path: "/v1/releases/cli/Amd64" },
};

export const NoBuildForArchitecture: Story = {
  args: {
    page: noBuildPage(
      LINKS,
      "cli",
      "Releases build for Amd64 only, and this link asks for Arm64",
      `${LINKS.api}/v1/releases/cli/Amd64`,
    ),
    path: "/v1/releases/cli/Arm64",
  },
};
