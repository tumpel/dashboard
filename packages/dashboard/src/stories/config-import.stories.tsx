import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { fakeApi, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/SecretSets/ConfigImport", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const path = tenantPath("/secrets");

const CONFIG = {
  personas: [
    {
      name: "example",
      harness: "ClaudeCode",
      secretSetName: "example",
      files: [{ path: ".claude/CLAUDE.md", from: "example/CLAUDE.md" }],
    },
  ],
  secretSets: [
    {
      name: "example",
      secrets: [
        {
          kind: "SubscriptionToken",
          name: "CLAUDE_CODE_OAUTH_TOKEN",
          provider: "Anthropic",
          expiresAt: { env: "EXAMPLE_CLAUDE_CODE_OAUTH_TOKEN_EXPIRES_AT" },
          valueFrom: { env: "EXAMPLE_CLAUDE_CODE_OAUTH_TOKEN" },
        },
        { kind: "Variable", name: "GITHUB_TOKEN", valueFrom: { env: "EXAMPLE_GITHUB_TOKEN" } },
      ],
    },
  ],
  harnessPins: [],
  hosts: [],
};

const upload = async (label: RegExp, file: File) => {
  const screen = within(document.body);
  await userEvent.upload(await screen.findByLabelText(label), file);
};

const chooseConfig = (text: string) => async () => {
  await upload(/Tenant config file/, new File([text], "example.json", { type: "application/json" }));
};

const enterEverything = async () => {
  await chooseConfig(JSON.stringify(CONFIG))();
  const screen = within(document.body);
  await upload(/File example\/CLAUDE\.md/, new File(["Work the issue.\n"], "CLAUDE.md"));
  await userEvent.type(
    await screen.findByLabelText("EXAMPLE_CLAUDE_CODE_OAUTH_TOKEN_EXPIRES_AT"),
    "2027-01-31T09:00:00+01:00",
  );
  await userEvent.type(await screen.findByLabelText("EXAMPLE_CLAUDE_CODE_OAUTH_TOKEN"), "placeholder-token");
  await userEvent.type(await screen.findByLabelText("EXAMPLE_GITHUB_TOKEN"), "placeholder-github-token");
  await userEvent.click(await screen.findByRole("button", { name: "Show the plan" }));
  await screen.findByText(/applying it deletes them/);
};

export const ChooseFile: Story = { args: { path, api: fakeApi() } };

export const EnterSecrets: Story = {
  args: { path, api: fakeApi() },
  play: enterEverything,
};

export const InvalidFile: Story = {
  args: { path, api: fakeApi() },
  play: chooseConfig(JSON.stringify({ ...CONFIG, hosts: undefined, personas: [{ name: "" }] })),
};

export const ApplyFailed: Story = {
  args: {
    path,
    api: fakeApi({
      applyTenantConfig: () =>
        Promise.reject(
          problem(
            422,
            "HarnessNotInCatalog",
            "Harness not in the catalog",
            "create persona example running ClaudeCode on secret set example was refused (personas.create names ClaudeCode, of which the catalog holds no version your tenant can run); applied before it: create secret set example",
            "Name a harness the harness catalog lists, or pin one of its listed versions",
          ),
        ),
    }),
  },
  play: async () => {
    await enterEverything();
    await userEvent.click(await within(document.body).findByRole("button", { name: "Apply" }));
  },
};
