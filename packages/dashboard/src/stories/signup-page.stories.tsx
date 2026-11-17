import type { Meta, StoryObj } from "@storybook/react-vite";
import { signUpPage } from "@tumpel/pages";
import { LINKS, ServerPage, WHO } from "./server-pages";

const meta: Meta<typeof ServerPage> = { title: "ControlPlane/SignUpPage", component: ServerPage };
export default meta;

type Story = StoryObj<typeof ServerPage>;

export const Idle: Story = { args: { page: signUpPage(LINKS, WHO), path: "/device" } };
