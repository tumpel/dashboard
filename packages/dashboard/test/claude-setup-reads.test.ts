import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClaudeSetup, ClaudeSetupStatus } from "../src/api/port.ts";
import { LIVE_READ_MS, nextSetupReadIn } from "../src/claude-setup-reads.ts";

const NOW = Date.parse("2026-11-16T15:22:00Z");
const due = new Date(NOW + 60_000).toISOString();

const setup = (status: ClaudeSetupStatus): ClaudeSetup => ({
  claudeSetupId: "cls_a",
  tenantId: "tnt_a",
  principalId: "prn_a",
  secretSetId: "sst_a",
  hostId: "hst_a",
  boxId: "box_a",
  harness: "ClaudeCode",
  harnessVersion: "2.1.4",
  status,
  createdAt: NOW,
  updatedAt: NOW,
});

test("a running setup is read every second until it ends", () => {
  const live: ClaudeSetupStatus[] = [
    { state: "Starting", urlDueAt: due },
    { state: "AwaitingCode", signInUrl: "https://claude.ai/oauth/authorize", codeDueAt: due },
    { state: "Minting", tokenDueAt: due },
  ];
  for (const status of live) assert.equal(nextSetupReadIn({ status: "success", data: setup(status) }), LIVE_READ_MS);
  const failed = setup({ state: "Failed", reason: "SetupTimedOut", detail: "no token", failedAt: due });
  const completed = setup({
    state: "Completed",
    memberName: "CLAUDE_CODE_OAUTH_TOKEN",
    expiresAt: "2027-11-16T15:21:55Z",
    completedAt: due,
  });
  assert.equal(nextSetupReadIn({ status: "success", data: failed }), false);
  assert.equal(nextSetupReadIn({ status: "success", data: completed }), false);
});

test("a failed read stops the reads until the person checks again", () => {
  assert.equal(nextSetupReadIn({ status: "error", data: setup({ state: "Minting", tokenDueAt: due }) }), false);
  assert.equal(nextSetupReadIn({ status: "pending", data: undefined }), false);
});
