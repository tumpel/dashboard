import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { TumpelApi } from "../../api/port";
import { fakeApi, HOSTS, never, StoryApp, unreachable } from "../harness";
import { allDone, nothingDone, setupPath } from "./fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/FirstRun/HostStep", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = setupPath("host");

const mintExpiring =
  (offsetMs: number): TumpelApi["mintEnrolmentToken"] =>
  async (seconds) => {
    const minted = await fakeApi().mintEnrolmentToken(seconds);
    return {
      ...minted,
      enrolmentToken: { ...minted.enrolmentToken, expiresAt: new Date(Date.now() + offsetMs).toISOString() },
    };
  };

const showCommand = async () => {
  await userEvent.click(await within(document.body).findByRole("button", { name: "Show the install command" }));
};

export const Idle: Story = { args: { path, api: nothingDone() } };

export const Minting: Story = { args: { path, api: nothingDone({ mintEnrolmentToken: never }) }, play: showCommand };

export const Waiting: Story = {
  args: { path, api: nothingDone({ mintEnrolmentToken: mintExpiring(3_600_000) }) },
  play: showCommand,
};

export const Done: Story = { args: { path, api: allDone() } };

export const DoneWhileOffline: Story = {
  args: { path, api: allDone({ listHosts: async () => HOSTS.filter((host) => host.state === "Offline") }) },
};

export const TokenExpired: Story = {
  args: { path, api: nothingDone({ mintEnrolmentToken: mintExpiring(-60_000) }) },
  play: showCommand,
};

export const MintRefused: Story = {
  args: {
    path,
    api: nothingDone({ mintEnrolmentToken: () => Promise.reject(unreachable("EnrolmentTokens_mint")) }),
  },
  play: showCommand,
};
