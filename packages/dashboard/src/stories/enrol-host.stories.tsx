import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, StoryApp, tenantPath, unreachable } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Hosts/EnrolHost", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/hosts#enrol");

const mintToken = async () => {
  await userEvent.click(await within(document.body).findByRole("button", { name: "Mint token" }));
};

export const ChooseExpiry: Story = { args: { path } };

export const TokenShown: Story = { args: { path }, play: mintToken };

const MintError: Story = {
  args: { path, api: fakeApi({ mintEnrolmentToken: () => Promise.reject(unreachable("EnrolmentTokens_mint")) }) },
  play: mintToken,
};

export { MintError as Error };
