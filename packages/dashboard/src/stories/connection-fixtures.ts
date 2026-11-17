import type {
  CircleCIAuthorization,
  CircleCIConnectionLink,
  CircleCIProject,
  ConnectionSummary,
  GitHubActionsConnectionLink,
  GitHubConnection,
  GitHubInstallation,
  NamespaceConnectionLink,
  Prebuild,
  PrebuildFailure,
  TumpelApi,
} from "../api/port";

export type ConnectionOperation =
  | "startGitHubConnection"
  | "deleteGitHubConnection"
  | "listConnections"
  | "getGitHubActionsConnection"
  | "startGitHubActionsConnection"
  | "deleteGitHubActionsConnection"
  | "getCircleCIConnection"
  | "startCircleCIConnection"
  | "deleteCircleCIConnection"
  | "authorizeCircleCIConnection"
  | "completeCircleCIConnection"
  | "chooseCircleCIOrganization"
  | "listCircleCIProjects"
  | "getNamespaceConnection"
  | "startNamespaceConnection"
  | "deleteNamespaceConnection"
  | "listPrebuilds"
  | "listLatestPrebuilds"
  | "startPrebuild"
  | "getPrebuildFailure";

type ConnectionApi = Pick<TumpelApi, ConnectionOperation>;

const TENANT_ID = "tnt_placeholder01";
const LINKED = Date.parse("2026-11-01T10:14:00+01:00");
const ISSUER = "https://id.example.com";
const SUBJECT = `tenant:${TENANT_ID}:persona:<personaName>:job:prebuild`;
const AUDIENCE = "federation.namespaceapis.com";
const REUSABLE_WORKFLOW = "tumpel/workflows/.github/workflows/prebuild.yml@v2";
const CALLER_EXAMPLE = `on: workflow_dispatch\njobs:\n  prebuild:\n    uses: ${REUSABLE_WORKFLOW}\n`;

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

export const GHA_CONNECTED: GitHubActionsConnectionLink = {
  tenantId: TENANT_ID,
  link: {
    state: "Connected",
    connection: {
      gitHubActionsConnectionId: "gac_placeholder01",
      tenantId: TENANT_ID,
      accountLabel: "owner-login",
      callerWorkflow: ".github/workflows/tumpel-prebuild.yml",
      createdAt: LINKED,
      updatedAt: LINKED,
    },
  },
  reusableWorkflow: REUSABLE_WORKFLOW,
  callerWorkflowExample: CALLER_EXAMPLE,
};

export const GHA_NOT_CONNECTED: GitHubActionsConnectionLink = {
  tenantId: TENANT_ID,
  link: { state: "NotConnected" },
  reusableWorkflow: REUSABLE_WORKFLOW,
  callerWorkflowExample: CALLER_EXAMPLE,
};

const CIRCLECI_ORGANIZATION = "6f1c2b3a-0d4e-4f5a-9b8c-7d6e5f4a3b2c";
const CIRCLECI_CONFIG = "version: 2.1\norbs:\n  tumpel: tumpel/prebuild@1\n";

export const CIRCLECI_NOT_CONNECTED: CircleCIConnectionLink = {
  tenantId: TENANT_ID,
  link: { state: "NotConnected" },
  orb: "tumpel/prebuild@1",
  configExample: CIRCLECI_CONFIG,
};

export const CIRCLECI_CONNECTED: CircleCIConnectionLink = {
  ...CIRCLECI_NOT_CONNECTED,
  link: {
    state: "Connected",
    connection: {
      circleCIConnectionId: "cci_placeholder01",
      tenantId: TENANT_ID,
      accountLabel: "Acme on CircleCI",
      organizationId: CIRCLECI_ORGANIZATION,
      issuer: `https://oidc.circleci.com/org/${CIRCLECI_ORGANIZATION}`,
      credential: { kind: "Authorized", expiresAt: "2027-02-13T09:30:00+01:00" },
      createdAt: Date.parse("2026-11-15T09:30:00+01:00"),
      updatedAt: Date.parse("2026-11-15T09:30:00+01:00"),
    },
  },
};

export const CIRCLECI_EXPIRED: CircleCIConnectionLink = {
  ...CIRCLECI_NOT_CONNECTED,
  link: {
    state: "Connected",
    connection: {
      circleCIConnectionId: "cci_placeholder01",
      tenantId: TENANT_ID,
      accountLabel: "Acme on CircleCI",
      organizationId: CIRCLECI_ORGANIZATION,
      issuer: `https://oidc.circleci.com/org/${CIRCLECI_ORGANIZATION}`,
      credential: { kind: "Authorized", expiresAt: "2026-11-14T09:30:00+01:00" },
      createdAt: Date.parse("2026-08-16T09:30:00+01:00"),
      updatedAt: Date.parse("2026-08-16T09:30:00+01:00"),
    },
  },
};

export const CIRCLECI_PROJECTS: CircleCIProject[] = [
  {
    circleCIProjectId: "ccp_placeholder01",
    tenantId: TENANT_ID,
    repository: "https://github.com/acme/app",
    projectSlug: "gh/acme/app",
    projectId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    pipelineDefinitionId: "11111111-2222-4333-8444-555555555555",
    createdAt: Date.parse("2026-11-15T09:40:00+01:00"),
    updatedAt: Date.parse("2026-11-15T09:40:00+01:00"),
  },
];

const CIRCLECI_AUTHORIZATION = {
  circleCIAuthorizationId: "cca_placeholder01",
  tenantId: TENANT_ID,
  principalId: "prn_placeholder01",
  createdAt: Date.parse("2026-11-15T14:02:11+01:00"),
  updatedAt: Date.parse("2026-11-15T14:02:11+01:00"),
};

export const CIRCLECI_REDIRECT_URI = "http://127.0.0.1:47151/circleci/callback";

export const CIRCLECI_AWAITING_REDIRECT: CircleCIAuthorization = {
  ...CIRCLECI_AUTHORIZATION,
  status: {
    state: "AwaitingRedirect",
    authorizeUrl:
      "https://app.circleci.com/oauth/authorize?response_type=code&client_id=placeholder&redirect_uri=http%3A%2F%2F127.0.0.1%3A47151%2Fcircleci%2Fcallback&code_challenge=placeholder&code_challenge_method=S256&state=placeholder",
    redirectUri: CIRCLECI_REDIRECT_URI,
    redirectDueAt: "2026-11-15T14:12:11+01:00",
  },
};

export const CIRCLECI_CHOOSING: CircleCIAuthorization = {
  ...CIRCLECI_AUTHORIZATION,
  status: {
    state: "ChoosingOrganization",
    organizations: [
      { organizationId: CIRCLECI_ORGANIZATION, name: "acme", slug: "gh/acme" },
      { organizationId: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a", name: "owner-login", slug: "gh/owner-login" },
    ],
    chooseDueAt: "2026-11-15T14:14:11+01:00",
  },
};

export const CIRCLECI_COMPLETED: CircleCIAuthorization = {
  ...CIRCLECI_AUTHORIZATION,
  status: {
    state: "Completed",
    organizationId: CIRCLECI_ORGANIZATION,
    accountLabel: "acme",
    expiresAt: "2027-02-13T14:04:11+01:00",
    completedAt: "2026-11-15T14:04:11+01:00",
  },
};

export const CIRCLECI_FAILED: CircleCIAuthorization = {
  ...CIRCLECI_AUTHORIZATION,
  status: {
    state: "Failed",
    reason: "CodeRefused",
    detail:
      "CircleCI answered POST /oauth/token with 400: invalid_grant; the code was spent, expired or does not match this authorization's verifier, so connect CircleCI again from the dashboard or with tumpel circleci authorize and paste the address straight away",
    failedAt: "2026-11-15T14:04:11+01:00",
  },
};

export const NAMESPACE_NOT_CONNECTED: NamespaceConnectionLink = {
  tenantId: TENANT_ID,
  link: { state: "NotConnected", issuer: ISSUER, subjectPattern: SUBJECT, audience: AUDIENCE },
};

export const NAMESPACE_CONNECTED: NamespaceConnectionLink = {
  tenantId: TENANT_ID,
  link: {
    state: "Connected",
    connection: {
      namespaceConnectionId: "nsc_placeholder01",
      tenantId: TENANT_ID,
      accountLabel: "Acme builds",
      workspaceId: "tenant_placeholder01",
      issuer: ISSUER,
      subjectPattern: SUBJECT,
      audience: AUDIENCE,
      createdAt: Date.parse("2026-11-15T09:30:00+01:00"),
      updatedAt: Date.parse("2026-11-15T09:30:00+01:00"),
    },
  },
};

type PlainState = Extract<ConnectionSummary["state"], "Connected" | "NotConnected" | "NotConfigured">;

export const summaries = (github: PlainState, gitHubActions: PlainState, namespace: PlainState): ConnectionSummary[] =>
  (
    [
      ["GitHub", github, "owner-login"],
      ["GitHubActions", gitHubActions, "owner-login"],
      ["CircleCI", "NotConnected", "Acme on CircleCI"],
      ["Namespace", namespace, "Acme builds"],
    ] as const
  ).map(
    ([kind, state, account]): ConnectionSummary => (state === "Connected" ? { kind, state, account } : { kind, state }),
  );

const digest = (seed: string): string => seed.repeat(64).slice(0, 64);

const prebuild = (
  prebuildId: string,
  repository: string,
  provider: Prebuild["provider"],
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
  provider,
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
  "GitHubActions",
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
  "Namespace",
  { state: "Failed", phase: "Build", finishedAt: "2026-11-15T12:44:00+01:00" },
  "2026-11-15T12:40:00+01:00",
  "a07e52",
);

export const BUILDING = prebuild(
  "pbd_building",
  DOCS,
  "GitHubActions",
  { state: "Building" },
  "2026-11-15T14:01:00+01:00",
  "91bd04",
);

export const PREBUILDS: Record<string, Prebuild[]> = {
  [REPO]: [DONE],
  [OTHER]: [FAILED],
  [DOCS]: [BUILDING],
};

export const FAILURE: PrebuildFailure = {
  prebuildId: FAILED.prebuildId,
  tenantId: TENANT_ID,
  phase: "Build",
  detail: "npm ci exited with status 1 on Namespace after 3 min 40 s. Lockfile and package.json disagree.",
  fix: "Run npm install, commit the lockfile, then Rebuild.",
  createdAt: Date.parse(FAILED.status.state === "Failed" ? FAILED.status.finishedAt : FAILED.startedAt),
};

export const connectionFakes = (): ConnectionApi => ({
  startGitHubConnection: async () => ({
    installUrl: "https://github.com/apps/example/installations/new?state=placeholder",
    expiresAt: "2026-11-15T15:02:11+01:00",
  }),
  listConnections: async () => summaries("Connected", "Connected", "NotConnected"),
  getGitHubActionsConnection: async () => GHA_CONNECTED,
  startGitHubActionsConnection: async () => GHA_CONNECTED,
  deleteGitHubConnection: async (_installationId: number) => undefined,
  deleteGitHubActionsConnection: async () => undefined,
  getCircleCIConnection: async () => CIRCLECI_NOT_CONNECTED,
  startCircleCIConnection: async () => CIRCLECI_CONNECTED,
  deleteCircleCIConnection: async () => undefined,
  authorizeCircleCIConnection: async () => CIRCLECI_AWAITING_REDIRECT,
  completeCircleCIConnection: async () => CIRCLECI_COMPLETED,
  chooseCircleCIOrganization: async () => CIRCLECI_COMPLETED,
  listCircleCIProjects: async () => CIRCLECI_PROJECTS,
  getNamespaceConnection: async () => NAMESPACE_NOT_CONNECTED,
  startNamespaceConnection: async () => NAMESPACE_CONNECTED,
  deleteNamespaceConnection: async () => undefined,
  listPrebuilds: async (repository) => PREBUILDS[repository] ?? [],
  listLatestPrebuilds: async () => [BUILDING, FAILED, DONE],
  startPrebuild: async (body) => ({
    ...(PREBUILDS[body.repository]?.[0] ?? DONE),
    prebuildId: body.rebuild ? "pbd_new" : (PREBUILDS[body.repository]?.[0]?.prebuildId ?? "pbd_new"),
    provider: body.provider,
    status: body.rebuild
      ? { state: "Dispatched" }
      : (PREBUILDS[body.repository]?.[0]?.status ?? { state: "Dispatched" }),
  }),
  getPrebuildFailure: async () => FAILURE,
});
