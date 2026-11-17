import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, problem, SESSIONS, StoryApp, tenantPath } from "./harness";
import { turnId } from "./session-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Sessions/StopSession", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const turnPath = (sessionId: string, rest = "") =>
  tenantPath(`/sessions/${sessionId}/turns/${turnId(sessionId, 3)}${rest}`);

export const Confirm: Story = { args: { path: turnPath("ses_4", "#stop") } };

export const Stopping: Story = {
  args: {
    path: turnPath("ses_4"),
    api: fakeApi({
      getSession: async (sessionId) => {
        const session = SESSIONS.find((item) => item.sessionId === sessionId);
        if (session === undefined) throw new Error(`No story session ${sessionId}; add it to SESSIONS in harness.tsx`);
        return { ...session, state: "Stopping" };
      },
    }),
  },
};

export const Refused: Story = {
  args: {
    path: turnPath("ses_1", "#stop"),
    api: fakeApi({
      stopSession: () =>
        Promise.reject(
          problem(
            409,
            "TurnInFlight",
            "Stop refused: TurnInFlight",
            "Turn 3 is running.",
            "Wait for the turn to finish, then stop.",
          ),
        ),
    }),
  },
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("button", { name: "Stop session" }));
  },
};

export const CancelTurn: Story = { args: { path: turnPath("ses_1", "#cancel") } };
