import type {
  ConnectionSummary,
  GitHubConnection,
  GitHubInstallation,
  Prebuild,
  PrebuildFailure,
  TumpelApi,
} from "../api/port";

export type ConnectionOperation =
  | "startGitHubConnection"
  | "deleteGitHubConnection"
  | "listConnections"
  | "listPrebuilds"
  | "listLatestPrebuilds"
  | "startPrebuild"
  | "getPrebuildFailure";

type ConnectionApi = Pick<TumpelApi, ConnectionOperation>;

const TENANT_ID = "tnt_placeholder01";
const LINKED = Date.parse("2026-11-01T10:14:00+01:00");
export const GITHUB_READY: GitHubConnection = {
  tenantId: TENANT_ID,
  app: { state: "Ready", appSlug: "example" },
};

export const GITHUB_APP_MISSING: GitHubConnection = {
  tenantId: TENANT_ID,
  app: { state: "AppMissing", setupUrl: "https://api.example.com/github/app/setup" },
};

export const GITHUB_INSTALLATIONS: GitHubInstallation[] = [
  {
    installationId: 41_000_001,
    tenantId: TENANT_ID,
    accountLogin: "owner-login",
    accountType: "User",
    status: "Active",
    createdAt: LINKED,
    updatedAt: LINKED,
  },
  {
    installationId: 41_000_002,
    tenantId: TENANT_ID,
    accountLogin: "owner-org",
    accountType: "Organization",
    status: "Active",
    createdAt: LINKED,
    updatedAt: LINKED,
  },
];

export const summaries = (github: ConnectionSummary["state"]): ConnectionSummary[] => [
  github === "Connected"
    ? { kind: "GitHub", state: github, account: "owner-login" }
    : { kind: "GitHub", state: github },
  { kind: "OpenRouter", state: "NotConnected" },
];

const digest = (seed: string): string => seed.repeat(64).slice(0, 64);

const prebuild = (
  prebuildId: string,
  repository: string,
  status: Prebuild["status"],
  startedAt: string,
  seed: string,
): Prebuild => ({
  prebuildId,
  tenantId: TENANT_ID,
  personaId: "prs_placeholder01",
  repository,
  inputDigest: digest(seed),
  guestImageDigest: digest("7c"),
  configSource: "RepositoryFile",
  status,
  startedAt,
  logUrl: `https://github.com/owner/${prebuildId}/actions/runs/1`,
  createdAt: Date.parse(startedAt),
  updatedAt: Date.parse(startedAt),
});

export const REPO = "https://github.com/owner/repo-name";
export const OTHER = "https://github.com/owner/other-repo";
export const DOCS = "https://github.com/owner/docs-site";

export const DONE = prebuild(
  "pbd_done",
  REPO,
  {
    state: "Done",
    layerDigest: digest("3f9a1c"),
    layerSizeBytes: 412 * 1024 ** 2,
    finishedAt: "2026-11-15T13:09:00+01:00",
  },
  "2026-11-15T13:02:00+01:00",
  "3f9a1c",
);

export const FAILED = prebuild(
  "pbd_failed",
  OTHER,
  { state: "Failed", phase: "Build", finishedAt: "2026-11-15T12:44:00+01:00" },
  "2026-11-15T12:40:00+01:00",
  "a07e52",
);

export const BUILDING = prebuild("pbd_building", DOCS, { state: "Building" }, "2026-11-15T14:01:00+01:00", "91bd04");

export const PREBUILDS: Record<string, Prebuild[]> = {
  [REPO]: [DONE],
  [OTHER]: [FAILED],
  [DOCS]: [BUILDING],
};

export const FAILURE: PrebuildFailure = {
  prebuildId: FAILED.prebuildId,
  tenantId: TENANT_ID,
  phase: "Build",
  detail: "npm ci exited with status 1 after 3 min 40 s. Lockfile and package.json disagree.",
  fix: "Run npm install, commit the lockfile, then Rebuild.",
  createdAt: Date.parse(FAILED.status.state === "Failed" ? FAILED.status.finishedAt : FAILED.startedAt),
};

export const connectionFakes = (): ConnectionApi => ({
  startGitHubConnection: async () => ({
    installUrl: "https://github.com/apps/example/installations/new?state=placeholder",
    expiresAt: "2026-11-15T15:02:11+01:00",
  }),
  listConnections: async () => summaries("Connected"),
  deleteGitHubConnection: async (_installationId: number) => undefined,
  listPrebuilds: async (repository) => PREBUILDS[repository] ?? [],
  listLatestPrebuilds: async () => [BUILDING, FAILED, DONE],
  startPrebuild: async (body) => ({
    ...(PREBUILDS[body.repository]?.[0] ?? DONE),
    prebuildId: body.rebuild ? "pbd_new" : (PREBUILDS[body.repository]?.[0]?.prebuildId ?? "pbd_new"),
    status: body.rebuild
      ? { state: "Dispatched" }
      : (PREBUILDS[body.repository]?.[0]?.status ?? { state: "Dispatched" }),
  }),
  getPrebuildFailure: async () => FAILURE,
});
