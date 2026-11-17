import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { GitHubRepository } from "../api/port";
import { fakeApi, never, problem, StoryApp, tenantPath } from "./harness";

const meta: Meta<typeof StoryApp> = {
  title: "Dashboard/Shared/RepositoryPicker",
  component: StoryApp,
  parameters: {
    viewport: { options: { phone: { name: "Phone, 390 px", styles: { width: "390px", height: "844px" } } } },
  },
  globals: { viewport: { value: "phone", isRotated: false } },
};
export default meta;

type Story = StoryObj<typeof StoryApp>;

const repository = (owner: string, name: string, defaultBranch: string, isPrivate: boolean): GitHubRepository => ({
  owner,
  name,
  defaultBranch,
  private: isPrivate,
  htmlUrl: `https://github.com/${owner}/${name}`,
});

const FIVE: GitHubRepository[] = [
  repository("owner-one", "api-gateway", "main", false),
  repository("owner-one", "service-name", "main", true),
  repository("owner-one", "tool-name", "trunk", false),
  repository("org-two", "api-name", "main", true),
  repository("org-two", "web-name", "main", false),
];

const BUILD = tenantPath("/sessions/new?source=prompt&persona=prs_placeholder01&repo=owner/repo-name&model=model-name");

const listing = (listRepositories: () => Promise<GitHubRepository[]>) => ({
  path: BUILD,
  api: fakeApi({ listRepositories }),
});

const five = listing(async () => FIVE);

const body = () => within(document.body);

const open = async () => {
  await userEvent.click(await body().findByRole("button", { name: "Repository" }));
};

const typeSearch = (text: string) => async () => {
  await open();
  await userEvent.type(await body().findByRole("combobox", { name: "Search repositories" }), text);
};

export const Loading: Story = { args: listing(never), play: open };

export const Results: Story = { args: five, play: open };

export const ResultsWide: Story = { args: five, globals: { viewport: { value: undefined } }, play: open };

export const Filtering: Story = { args: five, play: typeSearch("api") };

export const NoMatch: Story = { args: five, play: typeSearch("other-org/thing") };

export const NotConfigured: Story = {
  args: listing(() =>
    Promise.reject(
      problem(
        409,
        "GitHubAppMissing",
        "GitHub App not set up",
        "This stage has no GitHub App, so no repository can be listed",
        "An Owner sets up the GitHub App on Connections",
      ),
    ),
  ),
};

export const NotConnected: Story = {
  args: listing(() =>
    Promise.reject(
      problem(
        409,
        "GitHubNotConnected",
        "GitHub not connected",
        "Your tenant has not installed the stage's GitHub App, so no repository is covered",
        "Connect GitHub on Connections",
      ),
    ),
  ),
};

export const Selected: Story = {
  args: five,
  play: async () => {
    await open();
    await userEvent.click(await body().findByRole("option", { name: /org-two\/api-name/ }));
  },
};

export const ListingRefused: Story = {
  args: listing(() =>
    Promise.reject(
      problem(
        409,
        "RepositoryUnreadable",
        "GitHub refused the repository list",
        "GitHub answered 403 to the repositories of installation 4242 on org-two",
        "Open Connections and reconnect or remove that account",
      ),
    ),
  ),
  play: open,
};
