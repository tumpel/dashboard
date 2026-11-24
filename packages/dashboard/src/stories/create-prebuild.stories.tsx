import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Prebuild, TumpelApi } from "../api/port";
import { DONE, FAILURE } from "./connection-fixtures";
import { fakeApi, never, problem, StoryApp, signedOutFailure, tenantPath, unreachable } from "./harness";
import { devcontainerMissing, PREVIEW, PREVIEW_FINDINGS, pullRequest, WIZARD_REPO } from "./prebuild-template-fixtures";

const meta: Meta<typeof StoryApp> = { title: "Dashboard/Prebuilds/CreatePrebuild", component: StoryApp };
export default meta;

type Story = StoryObj<typeof StoryApp>;

const step = (path: string, query: string) => tenantPath(`/prebuilds/new${path}?repo=${WIZARD_REPO}${query}`);
const preview = step("/preview", "&template=npm@3");
const merge = step("/merge", "&template=npm@3&pr=42");
const build = step("/build", "&template=npm@3&pr=42");
const built = step("/build", "&template=npm@3&pr=42&prebuild=pbd_new");

const press = (name: string) => async () => {
  const page = within(document.body);
  await userEvent.click(await page.findByRole("button", { name }, { timeout: 5000 }));
};

const started = (status: Prebuild["status"]): Prebuild => ({
  ...DONE,
  prebuildId: "pbd_new",
  repository: `https://github.com/${WIZARD_REPO}`,
  startedAt: "2026-11-15T14:01:00+01:00",
  status,
});

const runOf = (status: Prebuild["status"]) =>
  fakeApi({ listPrebuilds: async () => [started(status)], getPrebuildFailure: async () => FAILURE });

export const Repository: Story = { args: { path: tenantPath("/prebuilds/new") } };

export const RepositoryPicked: Story = { args: { path: tenantPath(`/prebuilds/new?repo=${WIZARD_REPO}`) } };

export const TemplateChoose: Story = { args: { path: step("/template", "") } };

export const TemplateExistingConfig: Story = {
  args: {
    path: step("/template", ""),
    api: fakeApi({ previewPrebuild: async () => ({ ...PREVIEW, configSource: "RepositoryFile" }) }),
  },
};

export const TemplateError: Story = {
  args: {
    path: step("/template", ""),
    api: fakeApi({ listPrebuildTemplates: () => Promise.reject(unreachable("PrebuildTemplates_list")) }),
  },
};

export const PreviewReady: Story = { args: { path: preview } };

export const PreviewFindings: Story = {
  args: {
    path: preview,
    api: fakeApi({
      previewPrebuild: async (body) => {
        if (body.source === "RepositoryFile") throw devcontainerMissing;
        return PREVIEW_FINDINGS;
      },
    }),
  },
};

export const PreviewPullRequestRefused: Story = {
  args: {
    path: preview,
    api: fakeApi({
      openTemplatePullRequest: () =>
        Promise.reject(
          problem(
            409,
            "GitHubRefused",
            "GitHub refused the pull request",
            "GitHub answered 403 to the new branch tumpel/prebuild-template: Resource not accessible by integration.",
            "Give the Tumpel GitHub App write access to Contents and Pull requests on Connections, then try again.",
          ),
        ),
    }),
  },
  play: press("Open pull request"),
};

const PreviewError: Story = {
  args: {
    path: step("/preview", "&template=go@1"),
    api: fakeApi({
      getPrebuildTemplate: () =>
        Promise.reject(
          problem(
            404,
            "PrebuildTemplateNotFound",
            "No template go",
            "The control plane ships the templates npm, rust and python.",
            "Go back and pick one of them.",
          ),
        ),
    }),
  },
};

export { PreviewError as Error };

export const SignedOut: Story = {
  args: { path: preview, api: fakeApi({ getPrebuildTemplate: () => Promise.reject(signedOutFailure) }) },
};

export const MergeWaiting: Story = { args: { path: merge } };

export const MergeChecking: Story = { args: { path: merge, api: fakeApi({ getTemplatePullRequest: never }) } };

export const MergeMerged: Story = {
  args: { path: merge, api: fakeApi({ getTemplatePullRequest: async () => pullRequest("Merged") }) },
};

export const MergeClosed: Story = {
  args: { path: merge, api: fakeApi({ getTemplatePullRequest: async () => pullRequest("Closed") }) },
};

export const BuildReady: Story = { args: { path: build } };

const refusedStart = fn<TumpelApi["startPrebuild"]>(() => Promise.reject(devcontainerMissing));

export const BuildRefused: Story = {
  args: {
    path: build,
    api: fakeApi({ startPrebuild: refusedStart }),
  },
  play: async () => {
    await press("Build now")();
    await expect(refusedStart).toHaveBeenCalledWith({
      repository: `https://github.com/${WIZARD_REPO}`,
      personaId: "prs_placeholder01",
      rebuild: false,
    });
  },
};

export const BuildRunning: Story = { args: { path: built, api: runOf({ state: "Building" }) } };

export const BuildDone: Story = {
  args: {
    path: built,
    api: runOf({
      state: "Done",
      layerDigest: "3f9a1c".repeat(11).slice(0, 64),
      layerSizeBytes: 412 * 1024 ** 2,
      finishedAt: "2026-11-15T14:09:00+01:00",
    }),
  },
};

export const BuildFailed: Story = {
  args: { path: built, api: runOf({ state: "Failed", phase: "Build", finishedAt: "2026-11-15T14:06:00+01:00" }) },
};
