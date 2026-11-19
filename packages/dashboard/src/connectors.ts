import type { ConnectorStatus } from "./api/port";

export const AUTHORIZATION_READ_MS = 3000;
const CALLBACK_GRACE_MS = 30_000;

export interface PendingAuthorization {
  connectorId: string;
  before: ConnectorStatus;
  authorizeUrl: string;
  callbackDueAt: string;
}

const stampOf = (status: ConnectorStatus): string => {
  if (status.state === "Connected") return status.connectedAt;
  if (status.state === "AuthorizationFailed") return status.failedAt;
  if (status.state === "Disconnected") return status.disconnectedAt;
  return "";
};

export const authorizationSettled = (pending: PendingAuthorization, status: ConnectorStatus): boolean =>
  (status.state === "Connected" || status.state === "AuthorizationFailed") &&
  (status.state !== pending.before.state || stampOf(status) !== stampOf(pending.before));

export const stillAwaiting = (pending: PendingAuthorization, now: number): boolean =>
  now < Date.parse(pending.callbackDueAt) + CALLBACK_GRACE_MS;
