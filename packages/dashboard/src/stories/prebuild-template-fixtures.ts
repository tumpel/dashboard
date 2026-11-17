import {
  ApiFailure,
  type PrebuildPreview,
  type PrebuildTemplate,
  type PrebuildTemplatePullRequest,
  type PrebuildTemplateVersion,
  type TumpelApi,
} from "../api/port";

type TemplateApi = Pick<
  TumpelApi,
  | "previewPrebuild"
  | "listPrebuildTemplates"
  | "getPrebuildTemplate"
  | "openTemplatePullRequest"
  | "getTemplatePullRequest"
>;

const digest = (seed: string): string => seed.repeat(64).slice(0, 64);

export const WIZARD_REPO = "owner/repo-name";

const NPM_DEVCONTAINER = `{
  "onCreateCommand": "npm ci",
  "updateContentCommand": "npm run build --if-present",
  "postCreateCommand": "npm cache clean --force"
}
`;

export const TEMPLATES: PrebuildTemplate[] = [
  {
    prebuildTemplateId: "npm",
    versions: [
      {
        prebuildTemplateVersion: 3,
        summary: "Runs npm ci, then npm run build when the script exists.",
        installs: ["npm ci"],
        toolchains: [{ toolchain: "Node", toolchainVersion: "26.13.1" }],
        digest: digest("a1"),
      },
      {
        prebuildTemplateVersion: 2,
        summary: "Runs npm ci.",
        installs: ["npm ci"],
        toolchains: [{ toolchain: "Node", toolchainVersion: "24.4.0" }],
        digest: digest("a2"),
      },
    ],
  },
  {
    prebuildTemplateId: "rust",
    versions: [
      {
        prebuildTemplateVersion: 2,
        summary: "Runs cargo fetch, then cargo build --locked.",
        installs: ["cargo fetch", "cargo build --locked"],
        toolchains: [{ toolchain: "Rust", toolchainVersion: "1.100.0" }],
        digest: digest("b2"),
      },
    ],
  },
  {
    prebuildTemplateId: "python",
    versions: [
      {
        prebuildTemplateVersion: 1,
        summary: "Runs uv sync --frozen.",
        installs: ["uv sync --frozen"],
        toolchains: [{ toolchain: "Python", toolchainVersion: "3.15.2" }],
        digest: digest("c1"),
      },
    ],
  },
];

export const NPM_V3: PrebuildTemplateVersion = {
  prebuildTemplateId: "npm",
  prebuildTemplateVersion: 3,
  summary: "Runs npm ci, then npm run build when the script exists.",
  installs: ["npm ci"],
  toolchains: [{ toolchain: "Node", toolchainVersion: "26.13.1" }],
  digest: digest("a1"),
  devcontainer: NPM_DEVCONTAINER,
};

export const PREVIEW: PrebuildPreview = {
  repository: `https://github.com/${WIZARD_REPO}`,
  configSource: "Supplied",
  commands: [
    { lifecycle: "OnCreateCommand", label: "onCreateCommand", argv: ["/bin/sh", "-c", "npm ci"] },
    {
      lifecycle: "UpdateContentCommand",
      label: "updateContentCommand",
      argv: ["/bin/sh", "-c", "npm run build --if-present"],
    },
    { lifecycle: "PostCreateCommand", label: "postCreateCommand", argv: ["/bin/sh", "-c", "npm cache clean --force"] },
  ],
  containerEnv: {},
  inputDigest: digest("d4"),
  findings: [],
};

export const PREVIEW_FINDINGS: PrebuildPreview = {
  ...PREVIEW,
  findings: [
    {
      code: "ToolchainMismatch",
      field: ".nvmrc",
      detail: "The repository pins Node 22.1.0 and the guest image runs Node 26.13.1.",
      fix: "Update .nvmrc to 26.13.1, or remove it.",
    },
  ],
};

export const pullRequest = (state: PrebuildTemplatePullRequest["state"]): PrebuildTemplatePullRequest => ({
  repository: `https://github.com/${WIZARD_REPO}`,
  branch: "tumpel/prebuild-template",
  pullRequestNumber: 42,
  url: `https://github.com/${WIZARD_REPO}/pull/42`,
  state,
});

export const devcontainerMissing = new ApiFailure({
  kind: "Problem",
  status: 409,
  problem: {
    code: "DevcontainerMissing",
    title: "The repository has no devcontainer.json",
    detail:
      "owner/repo-name holds neither .devcontainer/devcontainer.json nor .devcontainer.json on its default branch.",
    fix: "Pick a template to add one in a pull request, or commit your own.",
  },
});

export const templateFakes = (): TemplateApi => ({
  previewPrebuild: async (body) => {
    if (body.source === "RepositoryFile") throw devcontainerMissing;
    return PREVIEW;
  },
  listPrebuildTemplates: async () => TEMPLATES,
  getPrebuildTemplate: async () => NPM_V3,
  openTemplatePullRequest: async () => pullRequest("Open"),
  getTemplatePullRequest: async () => pullRequest("Open"),
});
