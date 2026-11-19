import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizationSettled, type PendingAuthorization } from "../src/connectors.ts";

const pending = (before: PendingAuthorization["before"]): PendingAuthorization => ({
  connectorId: "con_1",
  before,
  authorizeUrl: "https://auth.example.com/authorize",
  callbackDueAt: "2026-11-15T14:17:11+01:00",
});

test("an authorization settles when the connector connects or fails after it started", () => {
  const fresh = pending({ state: "NotConnected" });
  assert.equal(authorizationSettled(fresh, { state: "NotConnected" }), false);
  assert.equal(authorizationSettled(fresh, { state: "Connected", connectedAt: "2026-11-15T14:08:00+01:00" }), true);
  assert.equal(
    authorizationSettled(fresh, {
      state: "AuthorizationFailed",
      reason: "AuthorizationDenied",
      detail: "declined",
      failedAt: "2026-11-15T14:08:00+01:00",
    }),
    true,
  );
});

test("a reauthorization waits until the connection or failure is a new one", () => {
  const connected = pending({ state: "Connected", connectedAt: "2026-11-01T10:00:00+01:00" });
  assert.equal(
    authorizationSettled(connected, { state: "Connected", connectedAt: "2026-11-01T10:00:00+01:00" }),
    false,
  );
  assert.equal(authorizationSettled(connected, { state: "Connected", connectedAt: "2026-11-15T14:08:00+01:00" }), true);
  const failed = pending({
    state: "AuthorizationFailed",
    reason: "RefreshRefused",
    detail: "revoked",
    failedAt: "2026-11-10T10:00:00+01:00",
  });
  assert.equal(authorizationSettled(failed, failed.before), false);
});
