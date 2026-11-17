import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { CircleCIConnectionLink, ConnectionSummary } from "../api/port";
import {
  CIRCLECI_AWAITING_REDIRECT,
  CIRCLECI_CHOOSING,
  CIRCLECI_CONNECTED,
  CIRCLECI_EXPIRED,
  CIRCLECI_FAILED,
  CIRCLECI_REDIRECT_URI,
  summaries,
} from "./connection-fixtures";
import { fakeApi, never, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Connections/ConnectCircleCI", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const dialogPath = tenantPath("/connections#connect-circleci");
const cardPath = tenantPath("/connections#providers");

const withCircleCI = (row: ConnectionSummary): ConnectionSummary[] =>
  summaries("Connected", "Connected", "NotConnected").map((each) => (each.kind === "CircleCI" ? row : each));

const EXPIRES_SOON = "2026-11-24T09:30:00+01:00";

const expiringLink = (): CircleCIConnectionLink =>
  CIRCLECI_CONNECTED.link.state === "Connected"
    ? {
        ...CIRCLECI_CONNECTED,
        link: {
          state: "Connected",
          connection: {
            ...CIRCLECI_CONNECTED.link.connection,
            credential: { kind: "Authorized", expiresAt: EXPIRES_SOON },
          },
        },
      }
    : CIRCLECI_CONNECTED;

const continueToCircleCI = async () => {
  window.open = () => null;
  const dialog = within(await within(document.body).findByRole("dialog"));
  await userEvent.click(await dialog.findByRole("button", { name: "Continue to CircleCI" }));
  return dialog;
};

const pasteAddress = async () => {
  const dialog = await continueToCircleCI();
  await userEvent.type(
    await dialog.findByLabelText("Address the browser landed on"),
    `${CIRCLECI_REDIRECT_URI}?code=placeholder&state=placeholder`,
  );
  await userEvent.click(dialog.getByRole("button", { name: "Connect" }));
};

export const NotConnected: Story = { args: { path: dialogPath } };

export const Authorizing: Story = {
  args: { path: dialogPath, api: fakeApi({ authorizeCircleCIConnection: never }) },
  play: async () => {
    await continueToCircleCI();
  },
};

export const PasteBack: Story = {
  args: { path: dialogPath, api: fakeApi({ authorizeCircleCIConnection: async () => CIRCLECI_AWAITING_REDIRECT }) },
  play: async () => {
    await continueToCircleCI();
  },
};

export const ChooseOrganization: Story = {
  args: { path: dialogPath, api: fakeApi({ completeCircleCIConnection: async () => CIRCLECI_CHOOSING }) },
  play: pasteAddress,
};

export const Failed: Story = {
  args: { path: dialogPath, api: fakeApi({ completeCircleCIConnection: async () => CIRCLECI_FAILED }) },
  play: pasteAddress,
};

export const TokenFallback: Story = {
  args: { path: dialogPath },
  play: async () => {
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(await dialog.findByRole("button", { name: "Paste a personal API token instead" }));
  },
};

export const Connected: Story = {
  args: {
    path: cardPath,
    api: fakeApi({
      listConnections: async () => withCircleCI({ kind: "CircleCI", state: "Connected", account: "Acme on CircleCI" }),
      getCircleCIConnection: async () => CIRCLECI_CONNECTED,
    }),
  },
};

export const Expiring: Story = {
  args: {
    path: cardPath,
    api: fakeApi({
      listConnections: async () =>
        withCircleCI({
          kind: "CircleCI",
          state: "Expiring",
          account: "Acme on CircleCI",
          expiresAt: EXPIRES_SOON,
        }),
      getCircleCIConnection: async () => expiringLink(),
    }),
  },
};

export const Expired: Story = {
  args: {
    path: cardPath,
    api: fakeApi({
      listConnections: async () =>
        withCircleCI({
          kind: "CircleCI",
          state: "Expired",
          account: "Acme on CircleCI",
          expiredAt: "2026-11-14T09:30:00+01:00",
        }),
      getCircleCIConnection: async () => CIRCLECI_EXPIRED,
    }),
  },
};
