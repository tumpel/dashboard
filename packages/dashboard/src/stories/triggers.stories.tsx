import type { Meta, StoryObj } from "@storybook/react-vite";
import { fakeApi, memberWhoami, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Triggers", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

export const List: Story = { args: { path: tenantPath("/triggers") } };

export const ListAsMember: Story = { args: { path: tenantPath("/triggers"), api: fakeApi({ whoami: memberWhoami }) } };

export const Empty: Story = {
  args: { path: tenantPath("/triggers"), api: fakeApi({ listTriggers: async () => [] }) },
};

export const Loading: Story = {
  args: { path: tenantPath("/triggers"), api: fakeApi({ listTriggers: never }) },
};

export const RefusalsExpired: Story = {
  args: {
    path: tenantPath("/triggers"),
    api: fakeApi({
      listEvents: () =>
        Promise.reject(
          problem(
            410,
            "EventCursorExpired",
            "Event cursor expired",
            "event 0 is older than the oldest event kept, 1204; the log keeps 7 days",
            "Read the current state of what you follow, then read events again without afterEventId",
          ),
        ),
    }),
  },
};

export const Runs: Story = { args: { path: tenantPath("/triggers/trg_placeholder01") } };

export const New: Story = { args: { path: tenantPath("/triggers/new") } };

export const Edit: Story = { args: { path: tenantPath("/triggers/trg_placeholder01/edit") } };

export const Test: Story = { args: { path: tenantPath("/triggers/trg_placeholder01/edit#test") } };

export const ReadOnlyForMember: Story = {
  args: { path: tenantPath("/triggers/trg_placeholder01/edit#test"), api: fakeApi({ whoami: memberWhoami }) },
};

export const SaveRefused: Story = {
  args: {
    path: tenantPath("/triggers/trg_placeholder01/edit"),
    api: fakeApi({
      updateTrigger: () =>
        Promise.reject(
          problem(
            422,
            "ModelUnsupported",
            "Model not supported",
            "Codex does not run claude-opus-5-5; it runs gpt-5.5-codex.",
            "Pick a model the persona's harness runs.",
          ),
        ),
    }),
  },
};
