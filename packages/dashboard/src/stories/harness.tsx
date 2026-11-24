import { createMemoryHistory } from "@tanstack/react-router";
import { useState } from "react";
import {
  ApiFailure,
  type AuthPort,
  type EffectiveHarnessVersion,
  type HarnessCatalogEntry,
  type Host,
  type Persona,
  type PersonaFileWrite,
  type Problem,
  type ReleaseManifest,
  type ReportedHostUsage,
  type SecretMemberUpdate,
  type SecretSet,
  type Session,
  type TumpelApi,
} from "../api/port";
import { App } from "../app";
import { claudeSetupFakes } from "./claude-setup-fixtures";
import { connectionFakes } from "./connection-fixtures";
import { connectorFakes } from "./connector-fixtures";
import { firstRunFakes } from "./first-run-fixtures";
import { memberFakes } from "./member-fixtures";
import { metricFakes } from "./metric-fixtures";
import { openRouterFakes } from "./openrouter-fixtures";
import { templateFakes } from "./prebuild-template-fixtures";
import { sessionFakes } from "./session-fixtures";
import { triggerFakes } from "./trigger-fixtures";

const NOW = Date.parse("2026-11-15T14:02:11+01:00");
export const TENANT_ID = "tnt_placeholder01";

const OLD_SUPERVISOR = "1".repeat(64);
const NEW_SUPERVISOR = "2".repeat(64);
const BAD_SUPERVISOR = "3".repeat(64);
const at = (minutesAgo: number): string => new Date(NOW - minutesAgo * 60_000).toISOString();

const host = (
  hostId: string,
  name: string,
  state: Host["state"],
  version: string,
  labels: string[],
  supervisorUpdateStep: Host["supervisorUpdateStep"] = { state: "NotReported" },
  supervisorUpdateFailure: Host["supervisorUpdateFailure"] = { state: "NotReported" },
): Host => ({
  hostId,
  tenantId: TENANT_ID,
  name,
  state,
  ...(state === "Online" ? { presence: "Online", heardAt: at(0) } : { presence: "Offline" }),
  architecture: "Amd64",
  cpuCount: 16,
  memoryBytes: 64 * 1024 ** 3,
  health: "Healthy",
  reportedHealth: "Healthy",
  publicKey: "placeholder-public-key",
  supervisorVersion: version,
  labels,
  supervisorUpdateStep,
  supervisorUpdateFailure,
  channelProtocol: { state: "NotReported" },
  guestProtocol: { state: "NotReported" },
  createdAt: Date.parse("2026-11-01T10:14:00+01:00"),
  updatedAt: NOW,
});

export const HOSTS: Host[] = [
  host("hst_placeholder01", "host-a", "Online", "0.9.2", ["gpu", "home"], {
    state: "Reported",
    step: {
      fromSha256: OLD_SUPERVISOR,
      toSha256: NEW_SUPERVISOR,
      releaseVersion: "v0.9.2",
      boxesRunning: 0,
      phase: "Online",
      at: at(42),
    },
  }),
  host(
    "hst_placeholder02",
    "host-b",
    "Online",
    "0.9.2",
    ["office"],
    {
      state: "Reported",
      step: {
        fromSha256: NEW_SUPERVISOR,
        toSha256: BAD_SUPERVISOR,
        releaseVersion: "v0.9.3",
        boxesRunning: 1,
        phase: "DryRunning",
        at: at(12),
      },
    },
    {
      state: "Reported",
      failure: {
        fromSha256: NEW_SUPERVISOR,
        toSha256: BAD_SUPERVISOR,
        reason: "SupervisorUpdateDryRunFailed",
        detail: `the check of supervisor ${BAD_SUPERVISOR.slice(0, 12)} exited with status 3; the running supervisor stays, and this host skips that binary until the release names another`,
        outputTail: [
          `supervisor ${BAD_SUPERVISOR.slice(0, 12)} starts as host hst_placeholder02`,
          "NotEnrolled: runtime.json does not match the SupervisorRuntime schema",
        ],
        failedAt: at(11),
      },
    },
  ),
  host("hst_placeholder03", "host-c", "Offline", "0.8.7", []),
  host("hst_placeholder04", "host-d", "Enrolled", "0.9.2", []),
  host("hst_placeholder05", "host-old", "Revoked", "0.8.7", []),
];

const usage = (
  hostId: string,
  boxCapacity: number,
  boxesRunning: number,
  loadAverage: number,
  memoryAvailableMib: number,
  updatedAt: number,
): ReportedHostUsage => ({
  hostId,
  tenantId: TENANT_ID,
  boxCapacity,
  boxesRunning,
  loadAverage,
  memoryAvailableMib,
  diskBudgetMib: 262_144,
  diskHeldMib: boxesRunning * 16_384,
  memoryBudgetMib: 65_536,
  memoryHeldMib: boxesRunning * 4096,
  reportedHealth: "Healthy",
  channelProtocol: 18,
  createdAt: updatedAt,
  updatedAt,
});

export const USAGE: ReportedHostUsage[] = [
  usage("hst_placeholder01", 4, 2, 1.2, 9812, NOW),
  usage("hst_placeholder02", 2, 0, 0.08, 3020, NOW - 6000),
  usage("hst_placeholder03", 2, 0, 0.31, 1204, Date.parse("2026-11-14T22:40:00+01:00")),
];

const session = (
  sessionId: string,
  hostId: string,
  state: Exclude<Session["state"], "Unknown">,
  harness: Session["harness"],
  repository = "https://github.com/owner/repo-name",
  personaId = "prs_placeholder01",
  updatedAt = NOW,
): Session => ({
  sessionId,
  tenantId: TENANT_ID,
  principalId: "prn_placeholder01",
  hostId,
  boxId: `box_${sessionId}`,
  personaId,
  repository,
  origin: { kind: "Prompt" },
  startedBy: { kind: "Person", principalId: "prn_placeholder01" },
  tags: [],
  harness,
  boxRetention: "Auto",
  harnessVersion: "2.1.4",
  model: "placeholder-model",
  state,
  lastTurnId: `trn_${sessionId}`,
  lastTurnState: state === "Running" ? "Running" : "Completed",
  lastTurnAt: new Date(updatedAt).toISOString(),
  lastTurn: {
    turnId: `trn_${sessionId}`,
    tenantId: TENANT_ID,
    sessionId,
    boxId: `box_${sessionId}`,
    prompt: "Work issue #42: Add a retry budget to the uploader.",
    state: state === "Running" ? "Running" : "Completed",
    lineCount: 214,
    createdAt: updatedAt - 600_000,
    updatedAt,
  },
  lastTurnImage: { kind: "Layered", baseImageDigest: "4c".repeat(32), harnessLayerDigest: "1".repeat(64) },
  prebuildLayer: { layer: "Prebuild", prebuildId: "pbd_placeholder01", layerDigest: "8".repeat(64) },
  createdAt: updatedAt - 3_600_000,
  updatedAt,
});

const MINUTE = 60_000;

export const SESSIONS: Session[] = [
  session("ses_1", "hst_placeholder01", "Running", "ClaudeCode", undefined, undefined, NOW - MINUTE),
  session(
    "ses_2",
    "hst_placeholder01",
    "Running",
    "ClaudeCode",
    "https://github.com/owner/other-repo",
    "prs_placeholder02",
    NOW - 3 * MINUTE,
  ),
  {
    ...session(
      "ses_3",
      "hst_placeholder02",
      "Idle",
      "Codex",
      "https://github.com/owner/docs-site",
      "prs_placeholder03",
      NOW - 22 * MINUTE,
    ),
    startedBy: { kind: "Trigger", triggerId: "trg_placeholder01", deliveryId: "d81f2c5e-4c10-11f1-8a2b-placeholder" },
  },
  session("ses_4", "hst_placeholder01", "Idle", "ClaudeCode", undefined, undefined, NOW - 67 * MINUTE),
  session(
    "ses_5",
    "hst_placeholder02",
    "Starting",
    "ClaudeCode",
    "https://github.com/owner/docs-site",
    "prs_placeholder02",
    NOW,
  ),
  {
    ...session(
      "ses_6",
      "hst_placeholder03",
      "Stopped",
      "Codex",
      undefined,
      "prs_placeholder03",
      Date.parse("2026-11-14T18:20:00+01:00"),
    ),
    startedBy: { kind: "Turn", sessionId: "ses_1", turnId: "trn_ses_1" },
  },
];

export const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);

export const problem = (status: number, code: Problem["code"], title: string, detail: string, fix: string) =>
  new ApiFailure({ kind: "Problem", status, problem: { code, title, detail, fix } });

export const unreachable = (operation: string) =>
  new ApiFailure({ kind: "Unreachable", detail: `${operation} got no response from the control plane.` });

export const signedOutFailure = problem(
  401,
  "SignedOut",
  "Not signed in",
  "this device or access token is missing, unknown, expired or revoked",
  "Sign the dashboard in again",
);

const digest = (seed: string): string => seed.repeat(64).slice(0, 64);

const claudeCode = (harnessVersion: string): HarnessCatalogEntry => ({
  harness: "ClaudeCode",
  harnessVersion,
  credentialChoice: "CatalogOrder",
  credentials: [
    {
      provider: "Anthropic",
      kind: "ApiKey",
      variable: "ANTHROPIC_API_KEY",
      fixed: [],
      arguments: [],
      costBasis: "Billed",
      modelSupport: { kind: "ProviderChecked" },
    },
    {
      provider: "Anthropic",
      kind: "SubscriptionToken",
      variable: "CLAUDE_CODE_OAUTH_TOKEN",
      fixed: [],
      arguments: [],
      costBasis: "NotBilled",
      modelSupport: { kind: "ProviderChecked" },
    },
    {
      provider: "OpenRouter",
      kind: "ApiKey",
      variable: "ANTHROPIC_AUTH_TOKEN",
      fixed: [{ name: "ANTHROPIC_BASE_URL", value: "https://openrouter.ai/api" }],
      arguments: [],
      costBasis: "Billed",
      modelSupport: { kind: "ProviderChecked" },
    },
  ],
  personaFilePaths: [".claude/CLAUDE.md", ".claude/settings.json", ".claude/agents/reviewer.md"],
  installRecipe: { kind: "Npm", package: "placeholder-claude-code", packageVersion: harnessVersion },
  compactTranscript: true,
  goals: false,
});

export const CATALOG: HarnessCatalogEntry[] = [
  claudeCode("2.1.5"),
  claudeCode("2.1.4"),
  {
    harness: "Codex",
    harnessVersion: "0.48.0",
    credentialChoice: "CatalogOrder",
    credentials: [
      {
        provider: "OpenAi",
        kind: "ApiKey",
        variable: "OPENAI_API_KEY",
        fixed: [],
        arguments: [],
        costBasis: "Billed",
        modelSupport: { kind: "ProviderChecked" },
      },
      {
        provider: "OpenAi",
        kind: "CredentialFile",
        variable: "CODEX_AUTH_JSON",
        path: ".codex/auth.json",
        fixed: [],
        arguments: [],
        costBasis: "NotBilled",
        modelSupport: { kind: "ProviderChecked" },
      },
    ],
    personaFilePaths: [".codex/AGENTS.md"],
    installRecipe: { kind: "Npm", package: "placeholder-codex", packageVersion: "0.48.0" },
    compactTranscript: true,
    goals: false,
  },
  {
    harness: "OpenCode",
    harnessVersion: "1.0.2",
    credentialChoice: "ModelProvider",
    credentials: [
      {
        provider: "OpenRouter",
        kind: "ApiKey",
        variable: "OPENROUTER_API_KEY",
        fixed: [],
        arguments: [],
        costBasis: "Billed",
        modelSupport: { kind: "ProviderChecked" },
      },
    ],
    personaFilePaths: [".config/opencode/opencode.json", ".config/opencode/AGENTS.md"],
    installRecipe: { kind: "Npm", package: "placeholder-opencode", packageVersion: "1.0.2" },
    compactTranscript: true,
    goals: false,
  },
  {
    harness: "PiDev",
    harnessVersion: "0.9.0",
    credentialChoice: "ModelProvider",
    credentials: [
      {
        provider: "Google",
        kind: "ApiKey",
        variable: "GEMINI_API_KEY",
        fixed: [],
        arguments: [],
        costBasis: "Billed",
        modelSupport: { kind: "ProviderChecked" },
      },
    ],
    personaFilePaths: [".pi/agent/settings.json", ".pi/agent/AGENTS.md"],
    installRecipe: { kind: "Npm", package: "placeholder-pi", packageVersion: "0.9.0" },
    compactTranscript: true,
    goals: false,
  },
];

export const PINS: EffectiveHarnessVersion[] = [
  { harness: "ClaudeCode", harnessVersion: "2.1.4", pinned: true },
  { harness: "Codex", harnessVersion: "0.48.0", pinned: true },
  { harness: "OpenCode", harnessVersion: "1.0.2", pinned: false },
  { harness: "PiDev", harnessVersion: "0.9.0", pinned: false },
];

const image = (
  harness: ReleaseManifest["images"][number]["harness"],
  harnessVersion: string,
  architecture: Host["architecture"],
) => ({
  harness,
  harnessVersion,
  architecture,
  imageDigest: digest("1"),
  kernelDigest: digest("2"),
  manifestDigest: digest("3"),
  ociDigest: digest("6"),
  rootfsDigest: digest("7"),
});

export const RELEASE: ReleaseManifest = {
  releaseVersion: "0.9.2",
  commit: digest("4").slice(0, 40),
  channelProtocolVersion: 9,
  supervisors: [
    {
      architecture: "Amd64",
      sha256: digest("5"),
      sizeBytes: 9_000_000,
      supervisorVersion: "0.9.2",
      downloadUrl: "https://github.com/tumpel/supervisor/releases/download/v0.9.2/tumpel-supervisor-x86_64-linux",
      guestProtocolVersion: 11,
    },
  ],
  clis: [
    {
      architecture: "Amd64",
      sha256: digest("7"),
      sizeBytes: 12_000_000,
      cliVersion: "0.9.2",
      downloadUrl: "https://github.com/tumpel/cli/releases/download/v0.9.2/tumpel-x86_64-linux",
    },
  ],
  images: [
    image("ClaudeCode", "2.1.4", "Amd64"),
    image("Codex", "0.48.0", "Amd64"),
    image("OpenCode", "1.0.2", "Amd64"),
  ],
  harnessLayers: [
    {
      harness: "ClaudeCode",
      harnessVersion: "2.1.4",
      architecture: "Amd64",
      layerDigest: digest("8"),
      manifestDigest: digest("9"),
      sizeBytes: 70_000_000,
    },
  ],
  bases: [
    {
      architecture: "Amd64",
      imageDigest: digest("1"),
      kernelDigest: digest("2"),
      manifestDigest: digest("3"),
      ociDigest: digest("6"),
      rootfsDigest: digest("7"),
    },
  ],
};

export const SECRET_SETS: SecretSet[] = [
  {
    secretSetId: "sst_placeholder01",
    tenantId: TENANT_ID,
    name: "Secret set A",
    keys: [
      {
        kind: "SubscriptionToken",
        name: "CLAUDE_CODE_OAUTH_TOKEN",
        provider: "Anthropic",
        expiresAt: "2026-11-14T09:00:00+01:00",
        updatedAt: Date.parse("2026-10-15T10:00:00+01:00"),
      },
      {
        kind: "ApiKey",
        name: "OPENROUTER_API_KEY",
        provider: "OpenRouter",
        updatedAt: Date.parse("2026-11-01T10:00:00+01:00"),
      },
      { kind: "Variable", name: "GITHUB_TOKEN", updatedAt: Date.parse("2026-11-01T10:00:00+01:00") },
      { kind: "Variable", name: "NPM_TOKEN", updatedAt: Date.parse("2026-11-03T10:00:00+01:00") },
    ],
    createdAt: Date.parse("2026-10-15T10:00:00+01:00"),
    updatedAt: Date.parse("2026-11-03T10:00:00+01:00"),
  },
  {
    secretSetId: "sst_placeholder02",
    tenantId: TENANT_ID,
    name: "Secret set B",
    keys: [
      {
        kind: "CredentialFile",
        name: "CODEX_AUTH_JSON",
        provider: "OpenAi",
        expiresAt: "2027-11-19T09:00:00+01:00",
        updatedAt: Date.parse("2026-11-01T10:00:00+01:00"),
      },
      { kind: "Variable", name: "GITHUB_TOKEN", updatedAt: Date.parse("2026-11-01T10:00:00+01:00") },
    ],
    createdAt: Date.parse("2026-11-01T10:00:00+01:00"),
    updatedAt: Date.parse("2026-11-01T10:00:00+01:00"),
  },
  {
    secretSetId: "sst_placeholder03",
    tenantId: TENANT_ID,
    name: "Scratch",
    keys: [{ kind: "Variable", name: "DEBUG", updatedAt: Date.parse("2026-11-02T10:00:00+01:00") }],
    createdAt: Date.parse("2026-11-02T10:00:00+01:00"),
    updatedAt: Date.parse("2026-11-02T10:00:00+01:00"),
  },
];

const storedFile = (path: string, digest: string, sizeBytes: number): Persona["files"][number] => ({
  source: "Stored",
  path,
  digest,
  sizeBytes,
  downloadUrl: `https://files.example.com/${digest}`,
  downloadExpiresAt: new Date(NOW + 3_600_000).toISOString(),
  createdAt: NOW,
  updatedAt: NOW,
});

const file = (path: string, kib: number, seed: string) => storedFile(path, digest(seed), kib * 1024);

const persona = (
  personaId: string,
  name: string,
  harness: Persona["harness"],
  secretSetId: string,
  files: Persona["files"],
): Persona => ({
  personaId,
  tenantId: TENANT_ID,
  name,
  harness,
  secretSetId,
  connectorIds: [],
  boxRetention: "Auto",
  tumpelMcp: false,
  files,
  createdAt: NOW,
  updatedAt: NOW,
});

export const PERSONAS: Persona[] = [
  {
    ...persona("prs_placeholder01", "Ticket worker", "ClaudeCode", "sst_placeholder01", [
      file(".claude/CLAUDE.md", 12, "a"),
      file(".claude/settings.json", 6, "b"),
    ]),
    connectorIds: ["con_placeholder01", "con_placeholder02"],
  },
  persona("prs_placeholder02", "Reviewer", "ClaudeCode", "sst_placeholder02", [file(".claude/CLAUDE.md", 4, "c")]),
  persona("prs_placeholder03", "Writer", "Codex", "sst_placeholder01", [file(".codex/AGENTS.md", 71, "d")]),
];

const filesOf = (writes: PersonaFileWrite[]): Persona["files"] =>
  writes.map((write) =>
    write.source === "Stored"
      ? storedFile(write.path, write.digest, write.sizeBytes)
      : {
          source: "Inline",
          path: write.path,
          content: write.content,
          digest: digest("9"),
          sizeBytes: atob(write.content).length,
          createdAt: NOW,
          updatedAt: NOW,
        },
  );

const keysOf = (secrets: readonly SecretMemberUpdate[]): SecretSet["keys"] =>
  secrets.map((secret) => {
    if (secret.kind === "Variable") return { kind: "Variable", name: secret.name, updatedAt: NOW };
    if (secret.kind === "ApiKey")
      return { kind: "ApiKey", name: secret.name, provider: secret.provider, updatedAt: NOW };
    return {
      kind: "SubscriptionToken",
      name: secret.name,
      provider: secret.provider,
      expiresAt: secret.expiresAt,
      updatedAt: NOW,
    };
  });

const notFound = (what: string, id: string, fix: string) =>
  problem(404, "NotFound", `No ${what} with this id in this tenant`, `No ${what} ${id}`, fix);

const findPersona = (personaId: string): Persona => {
  const found = PERSONAS.find((item) => item.personaId === personaId);
  if (found === undefined) throw notFound("persona", personaId, "Open Personas and pick one");
  return found;
};

const findSecretSet = (secretSetId: string): SecretSet => {
  const found = SECRET_SETS.find((item) => item.secretSetId === secretSetId);
  if (found === undefined) throw notFound("secret set", secretSetId, "Open Secret sets and pick one");
  return found;
};

const findHost = (hostId: string): Host => {
  const found = HOSTS.find((item) => item.hostId === hostId);
  if (found === undefined) {
    throw problem(
      404,
      "NotFound",
      "No host with this id in this tenant",
      `No host ${hostId}`,
      "Open Hosts and pick one",
    );
  }
  return found;
};

export const fakeApi = (overrides: Partial<TumpelApi> = {}): TumpelApi => ({
  whoami: async () => ({
    tenant: { tenantId: TENANT_ID, name: "Tenant name", tier: "Free", createdAt: NOW, updatedAt: NOW },
    principal: {
      principalId: "prn_placeholder01",
      tenantId: TENANT_ID,
      email: "user@example.com",
      role: "Owner",
      createdAt: NOW,
      updatedAt: NOW,
    },
  }),
  listHosts: async () => HOSTS,
  listHostUsage: async () => USAGE,
  getHost: async (hostId) => findHost(hostId),
  revokeHost: async (hostId) => ({ ...findHost(hostId), state: "Revoked" }),
  mintEnrolmentToken: async (expiresInSeconds) => ({
    enrolmentToken: {
      enrolmentTokenId: "ent_placeholder01",
      tenantId: TENANT_ID,
      principalId: "prn_placeholder01",
      state: "Unused",
      expiresAt: new Date(NOW + expiresInSeconds * 1000).toISOString(),
      createdAt: NOW,
      updatedAt: NOW,
    },
    token: "TOKEN_SHOWN_ONCE",
    installCommand:
      "curl -fL https://api.example.com/v1/releases/supervisor/Amd64 -o tumpel-supervisor && chmod +x tumpel-supervisor && ./tumpel-supervisor install --endpoint https://api.example.com --token-file -",
  }),
  listSessions: async () => SESSIONS,
  ...sessionFakes(SESSIONS, PERSONAS, NOW),
  listHarnessCatalog: async () => CATALOG,
  listHarnessPins: async () => PINS,
  pinHarness: async (pin) => ({ ...pin, updatedAt: NOW }),
  unpinHarness: async () => undefined,
  currentRelease: async () => RELEASE,
  getPersona: async (personaId) => findPersona(personaId),
  createPersona: async (created) => ({
    ...persona("prs_placeholder09", created.name, created.harness, created.secretSetId, []),
    connectorIds: created.connectorIds,
    files: filesOf(created.files ?? []),
  }),
  updatePersona: async (personaId, updated) => ({
    ...findPersona(personaId),
    ...updated,
    files: filesOf(updated.files),
    updatedAt: Date.now(),
  }),
  deletePersona: async () => undefined,
  uploadPersonaFile: async (fileDigest, sizeBytes) => ({
    digest: fileDigest,
    sizeBytes,
    uploadUrl: "https://files.example.com/placeholder-upload",
    uploadExpiresAt: "2026-11-15T14:17:11+01:00",
  }),
  putPersonaFile: async () => undefined,
  listSecretSets: async () => SECRET_SETS,
  getSecretSet: async (secretSetId) => findSecretSet(secretSetId),
  createSecretSet: async (created) => ({
    secretSetId: "sst_placeholder09",
    tenantId: TENANT_ID,
    name: created.name,
    keys: keysOf(created.secrets),
    createdAt: NOW,
    updatedAt: NOW,
  }),
  updateSecretSet: async (secretSetId, updated) => ({
    ...findSecretSet(secretSetId),
    name: updated.name,
    keys: keysOf(updated.secrets),
    updatedAt: Date.now(),
  }),
  deleteSecretSet: async () => undefined,
  ...connectionFakes(),
  ...connectorFakes(),
  ...memberFakes(),
  ...firstRunFakes(),
  ...claudeSetupFakes(),
  ...openRouterFakes(),
  ...metricFakes(),
  ...templateFakes(),
  ...triggerFakes(),
  getPushKey: async () => ({ applicationServerKey: "BPlaceholderApplicationServerKey" }),
  listPushSubscriptions: async () => [],
  createPushSubscription: async (created) => ({
    pushSubscriptionId: "psb_placeholder01",
    tenantId: TENANT_ID,
    principalId: "prn_placeholder01",
    endpoint: created.endpoint,
    events: created.events,
    createdAt: NOW,
  }),
  deletePushSubscription: async () => undefined,
  followEvents: () => () => undefined,
  ...overrides,
});

export const memberWhoami: TumpelApi["whoami"] = async () => {
  const me = await fakeApi().whoami();
  return { ...me, principal: { ...me.principal, role: "Member" } };
};

export const fakeAuth = (overrides: Partial<AuthPort> = {}): AuthPort => ({
  signIn: never,
  finishSignIn: never,
  signedInTenants: () => [{ tenantId: TENANT_ID, tenantName: "Tenant name", email: "user@example.com" }],
  signOut: async () => null,
  ...overrides,
});

export const StoryApp = ({
  path,
  api = fakeApi(),
  auth = fakeAuth(),
}: {
  path: string;
  api?: TumpelApi;
  auth?: AuthPort;
}) => {
  const [now] = useState(() => {
    const offset = NOW - Date.now();
    return () => Date.now() + offset;
  });
  return (
    <App
      key={path}
      ports={{
        apiFor: () => api,
        apiOrigin: "https://api.example.com",
        auth,
        reportIssueUrl: "https://github.com/tumpel/dashboard/issues/new",
        now,
      }}
      history={createMemoryHistory({ initialEntries: [path] })}
    />
  );
};

export const tenantPath = (rest: string): string => `/t/${TENANT_ID}${rest}`;
