import type { Persona, SecretSet, TumpelApi } from "../../api/port";
import { GITHUB_INSTALLATIONS, GITHUB_READY } from "../connection-fixtures";
import { CLAUDE_GRANT, DASHBOARD_GRANT } from "../first-run-fixtures";
import { fakeApi, HOSTS, TENANT_ID, tenantPath } from "../harness";

export const setupPath = (step: string, query = ""): string => tenantPath(`/setup/${step}${query}`);

const CREATED = Date.parse("2026-11-15T13:58:00+01:00");

export const DEFAULT_SET: SecretSet = {
  secretSetId: "sst_default",
  tenantId: TENANT_ID,
  name: "Default",
  keys: [],
  createdAt: CREATED,
  updatedAt: CREATED,
};

export const FILLED_SET: SecretSet = {
  ...DEFAULT_SET,
  keys: [
    {
      kind: "SubscriptionToken",
      name: "CLAUDE_CODE_OAUTH_TOKEN",
      provider: "Anthropic",
      expiresAt: "2099-11-15T00:00:00+01:00",
      updatedAt: CREATED,
    },
  ],
};

const DEFAULT_PERSONA: Persona = {
  personaId: "prs_default",
  tenantId: TENANT_ID,
  name: "Default",
  harness: "ClaudeCode",
  secretSetId: "sst_default",
  connectorIds: [],
  files: [],
  createdAt: CREATED,
  updatedAt: CREATED,
};

export const NOTHING_DONE: Partial<TumpelApi> = {
  getGitHubConnection: async () => GITHUB_READY,
  listGitHubInstallations: async () => [],
  listHosts: async () => [],
  listHostUsage: async () => [],
  listSessions: async () => [],
  listOAuthGrants: async () => [DASHBOARD_GRANT],
  listPersonas: async () => [DEFAULT_PERSONA],
  listSecretSets: async () => [DEFAULT_SET],
};

export const ALL_DONE: Partial<TumpelApi> = {
  getGitHubConnection: async () => GITHUB_READY,
  listGitHubInstallations: async () => GITHUB_INSTALLATIONS,
  listHosts: async () => HOSTS,
  listOAuthGrants: async () => [CLAUDE_GRANT, DASHBOARD_GRANT],
  listPersonas: async () => [DEFAULT_PERSONA],
  listSecretSets: async () => [FILLED_SET],
};

export const THREE_DONE: Partial<TumpelApi> = {
  ...ALL_DONE,
  listOAuthGrants: async () => [DASHBOARD_GRANT],
  listSecretSets: async () => [DEFAULT_SET],
};

export const nothingDone = (overrides: Partial<TumpelApi> = {}): TumpelApi =>
  fakeApi({ ...NOTHING_DONE, ...overrides });

export const allDone = (overrides: Partial<TumpelApi> = {}): TumpelApi => fakeApi({ ...ALL_DONE, ...overrides });
