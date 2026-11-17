import type { Meta, StoryObj } from "@storybook/react-vite";
import { noSuchPage, signInAgainPage } from "@tumpel/pages";
import { LINKS, ServerPage } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/SharedPages", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

export const SignInAgain: Story = {
  args: {
    page: signInAgainPage(LINKS, "the assertion expired", `${LINKS.api}/device`),
    path: "/device",
  },
};

export const NoSuchPage: Story = { args: { page: noSuchPage(LINKS, "/some/path"), path: "/some/path" } };
