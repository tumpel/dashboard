import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Sessions/StartSession", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const filled = tenantPath(
  `/sessions/new?source=prompt&persona=prs_placeholder01&repo=owner/repo-name&model=model-name`,
);

const fromIssue = (rest: string): string =>
  tenantPath(`/sessions/new?source=issue&persona=prs_placeholder01&model=model-name${rest}`);

const issueFilled = fromIssue("&repo=owner/repo-name&issue=42");
const issuePicker = fromIssue("&repo=owner/repo-name");

const openPicker =
  (name: string) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name }));
  };

const submit = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByRole("textbox", { name: "Prompt" }), "Work issue #42: add a retry budget.");
  await userEvent.click(canvas.getByRole("button", { name: "Start session" }));
};

const submitIssue = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole("button", { name: "Start session" }));
};

export const FromIssue: Story = { args: { path: issueFilled } };

export const Loading: Story = { args: { path: tenantPath("/sessions/new"), api: fakeApi({ listPersonas: never }) } };

export const RepositoryPickerOpen: Story = { args: { path: fromIssue("") }, play: openPicker("Repository") };

export const IssuePickerOpen: Story = { args: { path: issuePicker }, play: openPicker("Issue") };

export const IssuePickerError: Story = {
  args: {
    path: issuePicker,
    api: fakeApi({
      listIssues: () =>
        Promise.reject(
          problem(
            409,
            "RepositoryUnreadable",
            "GitHub refused the listing",
            "GitHub answered 403 to the issues of owner/repo-name",
            "Check the repositories the installation covers on GitHub, then list again",
          ),
        ),
    }),
  },
  play: openPicker("Issue"),
};

export const IssuePickerEmpty: Story = {
  args: { path: fromIssue("&repo=owner/docs-site") },
  play: openPicker("Issue"),
};

export const GitHubNotConnected: Story = {
  args: {
    path: fromIssue(""),
    api: fakeApi({
      listRepositories: () =>
        Promise.reject(
          problem(
            409,
            "GitHubNotConnected",
            "GitHub not connected",
            "GitHub is not connected, so no repository is covered",
            "Connect GitHub first",
          ),
        ),
    }),
  },
};

export const IssueClosed: Story = {
  args: {
    path: issueFilled,
    api: fakeApi({
      startSessionFromIssue: () =>
        Promise.reject(
          problem(
            409,
            "IssueNotOpen",
            "Issue not open",
            "https://github.com/owner/repo-name/issues/42 is a closed issue, and a session starts from an open issue only",
            "List the open issues of owner/repo-name and start from one of them",
          ),
        ),
    }),
  },
  play: submitIssue,
};

export const NoPersona: Story = {
  args: { path: tenantPath("/sessions/new"), api: fakeApi({ listPersonas: async () => [] }) },
};

export const WritePrompt: Story = { args: { path: filled } };

export const Submitting: Story = { args: { path: filled, api: fakeApi({ startSession: never }) }, play: submit };

export const PoolExhausted: Story = {
  args: {
    path: filled,
    api: fakeApi({
      startSession: () =>
        Promise.reject(
          problem(
            503,
            "PoolExhausted",
            "No box is free: PoolExhausted",
            "host-a: 4 of 4 slots in use. host-b: Offline since 2026-11-14 22:40.",
            "Stop an Idle session, bring host-b back Online, or enrol a host.",
          ),
        ),
    }),
  },
  play: submit,
};

export const CredentialRefused: Story = {
  args: {
    path: filled,
    api: fakeApi({
      startSession: () =>
        Promise.reject(
          problem(
            409,
            "CredentialExpired",
            "Credential expired: CredentialExpired",
            "Secret set A holds an Anthropic subscription token that expired 2026-11-14.",
            "Replace the token in Secret set A, then start again.",
          ),
        ),
    }),
  },
  play: submit,
};
