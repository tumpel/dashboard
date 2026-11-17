import type { OpenRouterAuthorization, OpenRouterAuthorizationStatus, TumpelApi } from "../api/port";

const TENANT_ID = "tnt_placeholder01";
const STARTED = Date.parse("2026-11-15T14:07:11+01:00");

export const openRouterAuthorization = (
  secretSetId: string,
  status: OpenRouterAuthorizationStatus,
): OpenRouterAuthorization => ({
  openRouterAuthorizationId: "ora_placeholder01",
  tenantId: TENANT_ID,
  principalId: "prn_placeholder01",
  secretSetId,
  status,
  createdAt: STARTED,
  updatedAt: STARTED,
});

export const AWAITING_CALLBACK: OpenRouterAuthorizationStatus = {
  state: "AwaitingCallback",
  authorizeUrl:
    "https://openrouter.ai/auth?callback_url=https%3A%2F%2Fapi.example.com%2Fopenrouter%2Fcallback%2Fplaceholder&code_challenge=placeholder&code_challenge_method=S256&key_label=Tumpel+Secret+set+B",
  callbackDueAt: "2026-11-15T14:17:11+01:00",
};

export const COMPLETED: OpenRouterAuthorizationStatus = {
  state: "Completed",
  keyLabel: "Tumpel Secret set A",
  completedAt: "2026-11-15T14:08:02+01:00",
};

export const DECLINED: OpenRouterAuthorizationStatus = {
  state: "Failed",
  reason: "NotConnected",
  detail:
    "OpenRouter sent the browser back without a code, as it does when the authorization is declined; choose Connect OpenRouter again on the secret set's page in the dashboard, or run tumpel openrouter authorize and choose Authorize on OpenRouter's page",
  failedAt: "2026-11-15T14:08:02+01:00",
};

export const openRouterFakes = (): Pick<TumpelApi, "authorizeOpenRouter" | "getOpenRouterAuthorization"> => ({
  authorizeOpenRouter: async (body) => openRouterAuthorization(body.secretSetId, AWAITING_CALLBACK),
  getOpenRouterAuthorization: async () => openRouterAuthorization("sst_placeholder01", COMPLETED),
});
