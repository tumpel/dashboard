import type { Connector, ConnectorStatus, TumpelApi } from "../api/port";

export type ConnectorOperation =
  | "listConnectors"
  | "createConnector"
  | "updateConnector"
  | "deleteConnector"
  | "setConnectorToken"
  | "clearConnectorCredential"
  | "authorizeConnector";

const TENANT_ID = "tnt_placeholder01";
const CREATED = Date.parse("2026-11-10T09:30:00+01:00");

const connector = (
  connectorId: string,
  auth: Connector["auth"],
  name: string,
  url: string,
  status: ConnectorStatus,
): Connector => ({ auth, connectorId, tenantId: TENANT_ID, name, url, status, createdAt: CREATED, updatedAt: CREATED });

export const CONNECTORS: Connector[] = [
  connector("con_placeholder01", "Static", "Docs search", "https://docs.example.com/mcp", {
    state: "Connected",
    connectedAt: "2026-11-10T09:31:00+01:00",
  }),
  connector("con_placeholder02", "OAuth", "Issue tracker", "https://mcp.tracker.example.com/mcp", {
    state: "Connected",
    connectedAt: "2026-11-12T16:04:00+01:00",
  }),
  connector("con_placeholder03", "OAuth", "Design files", "https://mcp.design.example.com/sse", {
    state: "AuthorizationFailed",
    reason: "RefreshRefused",
    detail:
      "the token endpoint of https://auth.design.example.com refused the refresh token with invalid_grant; authorize the connector again",
    failedAt: "2026-11-14T08:12:00+01:00",
  }),
  connector("con_placeholder04", "Static", "Metrics", "https://metrics.example.com/mcp", { state: "NotConnected" }),
  connector("con_placeholder05", "Static", "Old wiki", "https://wiki.example.com/mcp", {
    state: "Disconnected",
    disconnectedAt: "2026-11-13T11:00:00+01:00",
  }),
];

const find = (connectorId: string): Connector => {
  const found = CONNECTORS.find((item) => item.connectorId === connectorId);
  if (found === undefined) throw new Error(`no fixture connector ${connectorId}`);
  return found;
};

export const connectorFakes = (): Pick<TumpelApi, ConnectorOperation> => ({
  listConnectors: async () => CONNECTORS,
  createConnector: async (auth, body) =>
    connector("con_placeholder09", auth, body.name, body.url, { state: "NotConnected" }),
  updateConnector: async ({ connectorId }, body) => ({ ...find(connectorId), ...body, updatedAt: Date.now() }),
  deleteConnector: async () => undefined,
  setConnectorToken: async (current) => ({
    ...current,
    status: { state: "Connected", connectedAt: new Date().toISOString() },
    updatedAt: Date.now(),
  }),
  clearConnectorCredential: async (current) => ({
    ...current,
    status: { state: "Disconnected", disconnectedAt: new Date().toISOString() },
    updatedAt: Date.now(),
  }),
  authorizeConnector: async ({ connectorId }) => ({
    connectorAuthorizationId: "cna_placeholder01",
    connectorId,
    authorizeUrl: "https://auth.example.com/authorize?client_id=placeholder&code_challenge=placeholder",
    callbackDueAt: new Date(Date.now() + 600_000).toISOString(),
  }),
});
