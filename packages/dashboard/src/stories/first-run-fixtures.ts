import type { ConfigPlan, OAuthGrant, TumpelApi } from "../api/port";

const NOW = Date.parse("2026-11-15T14:02:11+01:00");

export const CLAUDE_GRANT: OAuthGrant = {
  grantId: "grant_placeholder01",
  clientId: "cli_placeholder01",
  clientName: "Claude",
  redirectOrigin: "https://claude.ai",
  lastIssuedAt: NOW,
};

export const DASHBOARD_GRANT: OAuthGrant = {
  grantId: "grant_placeholder02",
  clientId: "tumpel-dashboard",
  clientName: "the tumpel dashboard",
  redirectOrigin: "https://tumpel.example.com",
  lastIssuedAt: NOW,
};

export const IMPORT_PLAN: ConfigPlan = {
  changes: [
    {
      action: "Create",
      resource: "SecretSet",
      name: "example",
      description:
        "create secret set example: CLAUDE_CODE_OAUTH_TOKEN (SubscriptionToken for Anthropic, expires 2027-01-31T09:00:00+01:00) from $EXAMPLE_CLAUDE_CODE_OAUTH_TOKEN, GITHUB_TOKEN (Variable) from $EXAMPLE_GITHUB_TOKEN",
    },
    {
      action: "Create",
      resource: "Persona",
      name: "example",
      description:
        "create persona example running ClaudeCode on secret set example; files: write .claude/CLAUDE.md (812 bytes, sha256 placeholder)",
    },
    {
      action: "Delete",
      resource: "Persona",
      name: "Default",
      description: "delete persona Default (prs_placeholder00)",
    },
    {
      action: "Delete",
      resource: "SecretSet",
      name: "Default",
      description: "delete secret set Default (sst_placeholder00)",
    },
  ],
};

export const firstRunFakes = (): Pick<TumpelApi, "listOAuthGrants" | "planTenantConfig" | "applyTenantConfig"> => ({
  listOAuthGrants: async () => [CLAUDE_GRANT, DASHBOARD_GRANT],
  planTenantConfig: async () => IMPORT_PLAN,
  applyTenantConfig: async () => IMPORT_PLAN,
});
