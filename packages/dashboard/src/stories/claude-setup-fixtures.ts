import { userEvent, within } from "storybook/test";
import type { ClaudeSetup, ClaudeSetupStatus, TumpelApi } from "../api/port";

const NOW = Date.parse("2026-11-15T14:02:11+01:00");
const MINUTE = 60_000;

export const claudeSetup = (
  status: ClaudeSetupStatus,
  secretSetId = "sst_default",
  harness: ClaudeSetup["harness"] = "ClaudeCode",
): ClaudeSetup => ({
  claudeSetupId: "cls_placeholder01",
  tenantId: "tnt_placeholder01",
  principalId: "prn_placeholder01",
  secretSetId,
  hostId: "hst_placeholder01",
  boxId: "box_placeholder01",
  harness,
  harnessVersion: harness === "Codex" ? "0.169.0" : "2.1.4",
  status,
  createdAt: NOW,
  updatedAt: NOW,
});

export const STARTING: ClaudeSetupStatus = { state: "Starting", urlDueAt: new Date(NOW + 4 * MINUTE).toISOString() };

export const awaitingCode = (): ClaudeSetupStatus => ({
  state: "AwaitingCode",
  signInUrl: "https://claude.ai/oauth/authorize?code=true&client_id=placeholder&state=placeholder",
  codeDueAt: new Date(NOW + 9 * MINUTE).toISOString(),
});

export const MINTING: ClaudeSetupStatus = { state: "Minting", tokenDueAt: new Date(NOW + 2 * MINUTE).toISOString() };

export const COMPLETED: ClaudeSetupStatus = {
  state: "Completed",
  memberName: "CLAUDE_CODE_OAUTH_TOKEN",
  expiresAt: "2027-11-15T14:09:40+01:00",
  completedAt: "2026-11-15T14:09:40+01:00",
};

export const failed = (reason: Extract<ClaudeSetupStatus, { state: "Failed" }>["reason"], detail: string) =>
  ({ state: "Failed", reason, detail, failedAt: "2026-11-15T14:12:11+01:00" }) satisfies ClaudeSetupStatus;

export const FAILURES = {
  SetupUrlMissing: failed(
    "SetupUrlMissing",
    "The box on host-a printed no sign-in URL within 300 seconds of its offer.",
  ),
  CodeRejected: failed("CodeRejected", "Claude Code answered: Invalid code. [token] was not printed."),
  SetupTimedOut: failed("SetupTimedOut", "No code arrived within 600 seconds of the sign-in URL."),
  MintTimedOut: failed(
    "SetupTimedOut",
    "Claude Code minted no token for Claude setup cls_placeholder01 within claudeSetupMintBudgetSeconds 120 of the code; start the Claude setup again.",
  ),
  Superseded: failed(
    "Superseded",
    "Claude setup cls_placeholder02 of secret set sst_default started, and a secret set runs one setup at a time; follow Claude setup cls_placeholder02.",
  ),
  TokenNotStored: failed(
    "TokenNotStored",
    "The control plane refused the token write: the secret set was deleted. The box discarded the token.",
  ),
} as const;

export const claudeSetupFakes = (): Pick<
  TumpelApi,
  "startClaudeSetup" | "listClaudeSetups" | "getClaudeSetup" | "submitClaudeSetupCode"
> => ({
  startClaudeSetup: async (secretSetId) => claudeSetup(STARTING, secretSetId),
  listClaudeSetups: async () => [],
  getClaudeSetup: async () => claudeSetup(STARTING),
  submitClaudeSetupCode: async () => claudeSetup(MINTING),
});

export const settled = (status: () => ClaudeSetupStatus): Pick<TumpelApi, "startClaudeSetup" | "getClaudeSetup"> => ({
  startClaudeSetup: async (secretSetId) => claudeSetup(status(), secretSetId),
  getClaudeSetup: async () => claudeSetup(status()),
});

export const resumed = (
  status: () => ClaudeSetupStatus,
): Pick<TumpelApi, "listClaudeSetups" | "getClaudeSetup" | "submitClaudeSetupCode"> => ({
  listClaudeSetups: async (secretSetId) => [claudeSetup(status(), secretSetId)],
  getClaudeSetup: async () => claudeSetup(status()),
  submitClaudeSetupCode: async () => claudeSetup(MINTING),
});

export const startSetup = async () => {
  const screen = within(document.body);
  await userEvent.click(await screen.findByRole("button", { name: "Set up Claude Code" }));
};

export const enterCode = async () => {
  await startSetup();
  const screen = within(document.body);
  await userEvent.type(await screen.findByLabelText("Sign-in code"), "placeholder-code");
  await userEvent.click(await screen.findByRole("button", { name: "Send code" }));
};

export const codexDeviceCode = (): ClaudeSetupStatus => ({
  state: "AwaitingCode",
  signInUrl: "https://auth.openai.com/codex/device",
  userCode: "K7QD-3MZP9",
  codeDueAt: new Date(NOW + 9 * MINUTE).toISOString(),
});

export const CODEX_COMPLETED: ClaudeSetupStatus = {
  state: "Completed",
  memberName: "CODEX_AUTH_JSON",
  expiresAt: "2026-11-25T14:09:40+01:00",
  completedAt: "2026-11-15T14:09:40+01:00",
};

export const codexSettled = (
  status: () => ClaudeSetupStatus,
): Pick<TumpelApi, "startClaudeSetup" | "getClaudeSetup"> => ({
  startClaudeSetup: async (secretSetId) => claudeSetup(status(), secretSetId, "Codex"),
  getClaudeSetup: async () => claudeSetup(status(), "sst_default", "Codex"),
});

export const startCodexSignIn = async () => {
  const screen = within(document.body);
  await userEvent.click(await screen.findByRole("button", { name: "Sign in to Codex" }));
};
