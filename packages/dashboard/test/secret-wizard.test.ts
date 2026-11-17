import assert from "node:assert/strict";
import { test } from "node:test";
import type { HarnessCatalogEntry, SecretKey } from "../src/api/port.ts";
import { catalogKinds, catalogVariable, withSecret } from "../src/secret-wizard.ts";

const credentials = (list: HarnessCatalogEntry["credentials"]): HarnessCatalogEntry =>
  ({ credentials: list }) as HarnessCatalogEntry;

const CATALOG = [
  credentials([
    {
      provider: "Anthropic",
      kind: "ApiKey",
      variable: "ANTHROPIC_API_KEY",
      fixed: [],
      arguments: [],
      costBasis: "Billed",
    },
    {
      provider: "Anthropic",
      kind: "SubscriptionToken",
      variable: "CLAUDE_CODE_OAUTH_TOKEN",
      fixed: [],
      arguments: [],
      costBasis: "NotBilled",
    },
    {
      provider: "OpenRouter",
      kind: "ApiKey",
      variable: "ANTHROPIC_AUTH_TOKEN",
      fixed: [{ name: "ANTHROPIC_BASE_URL", value: "https://openrouter.ai/api" }],
      arguments: [],
      costBasis: "Billed",
    },
  ]),
  credentials([
    {
      provider: "OpenRouter",
      kind: "ApiKey",
      variable: "OPENROUTER_API_KEY",
      fixed: [],
      arguments: [],
      costBasis: "Billed",
    },
  ]),
];

test("the variable name comes from the catalog entry that needs no fixed variables", () => {
  assert.equal(catalogVariable(CATALOG, "OpenRouter", "ApiKey"), "OPENROUTER_API_KEY");
  assert.equal(catalogVariable(CATALOG, "Anthropic", "SubscriptionToken"), "CLAUDE_CODE_OAUTH_TOKEN");
  assert.deepEqual(catalogKinds(CATALOG, "Anthropic"), ["ApiKey", "SubscriptionToken"]);
  assert.deepEqual(catalogKinds(CATALOG, "OpenRouter"), ["ApiKey"]);
});

test("adding a secret keeps every stored value and replaces the provider's credential", () => {
  const stored: SecretKey[] = [
    { kind: "ApiKey", name: "ANTHROPIC_API_KEY", provider: "Anthropic", updatedAt: 0 },
    {
      kind: "SubscriptionToken",
      name: "OLD",
      provider: "OpenAi",
      expiresAt: "2027-01-01T00:00:00+00:00",
      updatedAt: 0,
    },
    { kind: "Variable", name: "NPM_TOKEN", updatedAt: 0 },
  ];
  const added = {
    kind: "SubscriptionToken",
    name: "CLAUDE_CODE_OAUTH_TOKEN",
    provider: "Anthropic",
    value: "token",
    expiresAt: "2027-11-16T00:00:00+01:00",
  } as const;
  assert.deepEqual(withSecret(stored, added), [
    { kind: "SubscriptionToken", name: "OLD", provider: "OpenAi", expiresAt: "2027-01-01T00:00:00+00:00" },
    { kind: "Variable", name: "NPM_TOKEN" },
    added,
  ]);
  assert.deepEqual(withSecret(stored, { kind: "Variable", name: "NPM_TOKEN", value: "new" }).at(-1), {
    kind: "Variable",
    name: "NPM_TOKEN",
    value: "new",
  });
  assert.equal(withSecret(stored, { kind: "Variable", name: "NPM_TOKEN", value: "new" }).length, 3);
});
