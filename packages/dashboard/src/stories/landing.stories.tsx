import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeAuth, StoryApp } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SignIn/Landing", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const SignedOut: Story = { args: { path: "/", auth: fakeAuth({ signedInTenants: () => [] }) } };
