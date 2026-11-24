import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { Session } from "../api/port";
import { fakeApi, never, problem, SESSIONS, StoryApp, signedOutFailure, tenantPath } from "./harness";
import { CATALOG_WITHOUT_SPEND } from "./metric-fixtures";
import { transcriptPage, turnId, turnsFor } from "./session-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Sessions/SessionDetail", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const NOW = Date.parse("2026-11-15T14:02:11+01:00");

const sessionOf = (sessionId: string): Session => {
  const found = SESSIONS.find((session) => session.sessionId === sessionId);
  if (found === undefined) throw new Error(`No story session ${sessionId}; add it to SESSIONS in harness.tsx`);
  return found;
};

const turnPath = (sessionId: string, rest = "") =>
  tenantPath(`/sessions/${sessionId}/turns/${turnId(sessionId, 3)}${rest}`);

export const Live: Story = { args: { path: turnPath("ses_1") } };

export const Loading: Story = {
  args: { path: turnPath("ses_1"), api: fakeApi({ getSession: never, listTurns: never }) },
};

export const Idle: Story = { args: { path: turnPath("ses_4") } };

export const WithoutPrebuild: Story = {
  args: {
    path: turnPath("ses_4"),
    api: fakeApi({
      getSession: async () => ({
        ...sessionOf("ses_4"),
        lastTurnImage: { kind: "Full", guestImageDigest: "7e".repeat(32) },
        prebuildLayer: {
          layer: "None",
          reason: "NoPrebuild",
          detail:
            "https://github.com/owner/repo-name has no stored prebuild; start a prebuild of it so later sessions start from its layer",
        },
      }),
    }),
  },
};

export const SendRefused: Story = {
  args: {
    path: turnPath("ses_4"),
    api: fakeApi({
      sendTurn: () =>
        Promise.reject(
          problem(
            409,
            "CredentialExpired",
            "Credential expired",
            "Secret set A holds an Anthropic subscription token that expired 2026-11-14.",
            "Replace the token in Secret set A, then send again.",
          ),
        ),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole("textbox", { name: "Next prompt" }), "Address the review comments");
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
  },
};

export const TurnFailed: Story = {
  args: {
    path: turnPath("ses_4"),
    api: fakeApi({ listTurns: async () => turnsFor(sessionOf("ses_4"), "Failed") }),
  },
};

export const ReadError: Story = {
  args: {
    path: turnPath("ses_1"),
    api: fakeApi({
      readTranscript: async (sessionId, query) => {
        if (query.after === undefined) return transcriptPage(sessionOf(sessionId), query, false, NOW);
        throw problem(
          400,
          "InvalidRequest",
          "The transcript read failed",
          `Transcripts_read refused the read after line ${query.after}.`,
          "Resume reads on from the last line shown. Nothing is lost.",
        );
      },
    }),
  },
};

export const SignedOut: Story = {
  args: {
    path: turnPath("ses_1"),
    api: fakeApi({
      readTranscript: async (sessionId, query) => {
        if (query.after === undefined) return transcriptPage(sessionOf(sessionId), query, false, NOW);
        throw signedOutFailure;
      },
    }),
  },
};

export const Archived: Story = {
  args: {
    path: turnPath("ses_6"),
    api: fakeApi({ getSession: async () => ({ ...sessionOf("ses_6"), state: "Archived" }) }),
  },
};

export const SnapshotsTab: Story = { args: { path: turnPath("ses_4", "?tab=snapshots") } };

export const HandoversTab: Story = { args: { path: turnPath("ses_4", "?tab=handovers") } };

export const StopFailuresTab: Story = {
  args: {
    path: turnPath("ses_4", "?tab=stop-failures"),
    api: fakeApi({
      listStopFailures: async (sessionId) => [
        {
          stopFailureId: "stf_1",
          tenantId: sessionOf(sessionId).tenantId,
          sessionId,
          reason: "NotAnswered",
          detail: "The host did not answer the stop within its budget. Stop again once the host is Online.",
          failedAt: "2026-11-15T12:10:00+01:00",
          createdAt: NOW,
        },
      ],
    }),
  },
};

export const CostTab: Story = { args: { path: turnPath("ses_4", "?tab=cost") } };

export const CostNotReported: Story = {
  args: {
    path: turnPath("ses_4", "?tab=cost"),
    api: fakeApi({ metricCatalog: async () => CATALOG_WITHOUT_SPEND }),
  },
};

export const StartupTab: Story = { args: { path: turnPath("ses_4", "?tab=startup") } };

export const StartupNotReported: Story = {
  args: {
    path: turnPath("ses_4", "?tab=startup"),
    api: fakeApi({
      metricCatalog: async () => ({
        metrics: CATALOG_WITHOUT_SPEND.metrics.filter((item) => item.metric !== "turn.phase"),
      }),
    }),
  },
};
