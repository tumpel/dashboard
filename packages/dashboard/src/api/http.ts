import type { paths } from "@tumpel/openapi/paths";
import {
  CircleCIAuthorizationSchema,
  CircleCIConnectionLinkSchema,
  CircleCIProjectSchema,
  ClaudeSetupSchema,
  ConfigPlanSchema,
  ConnectionSummarySchema,
  ConnectorAuthorizationSchema,
  ConnectorSchema,
  CredentialHandoverSchema,
  DeviceSchema,
  EffectiveHarnessVersionSchema,
  EventPageSchema,
  EventProblemSchema,
  GitHubActionsConnectionLinkSchema,
  GitHubConnectionSchema,
  GitHubInstallationSchema,
  GitHubInstallStartSchema,
  GitHubIssueSchema,
  GitHubRepositorySchema,
  HarnessCatalogEntrySchema,
  HarnessPinSchema,
  HostSchema,
  InvitationCreatedSchema,
  InvitationSchema,
  MembershipSchema,
  MetricCatalogSchema,
  MetricSeriesSetSchema,
  MetricTurnPageSchema,
  MintedEnrolmentTokenSchema,
  NamespaceConnectionLinkSchema,
  OAuthGrantSchema,
  OpenRouterAuthorizationSchema,
  PersonaFileUploadSchema,
  PersonaSchema,
  PrebuildFailureSchema,
  PrebuildPreviewSchema,
  PrebuildSchema,
  PrebuildTemplatePullRequestSchema,
  PrebuildTemplateSchema,
  PrebuildTemplateVersionSchema,
  PrincipalSchema,
  ProblemSchema,
  PushKeySchema,
  PushSubscriptionSchema,
  ReleaseManifestSchema,
  ReportedHostUsageSchema,
  SecretSetSchema,
  SessionSchema,
  SnapshotSchema,
  StartedSessionFromIssueSchema,
  StartedSessionSchema,
  SteerSchema,
  StopFailureSchema,
  TenantEventSchema,
  TranscriptPageSchema,
  TriggerSchema,
  TriggerTestResultSchema,
  TurnSchema,
  WhoamiSchema,
} from "@tumpel/schemas";
import createClient from "openapi-fetch";
import { z } from "zod";
import type { TokenLookup } from "../auth/oauth";
import { ApiFailure, type EventListener, type PersonaFileUpload, type Problem, type TumpelApi } from "./port.ts";

type Sent = { data?: unknown; error?: unknown; response: Response };

const REQUEST_LIMIT_MS = 15_000;
const RECONNECT_MS = 1000;
const RECONNECT_CAP_MS = 30_000;
const BEARER_SUBPROTOCOL = "tumpel.bearer";

const timedOut = (error: unknown): boolean => error instanceof DOMException && error.name === "TimeoutError";

const parsed = <T>(operation: string, schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "the body"))].join(", ");
  throw new ApiFailure({
    kind: "OutOfStep",
    operation,
    detail: `The ${operation} answer does not match what this dashboard expects at ${fields}.`,
  });
};

const settle = async <T>(
  operation: string,
  schema: z.ZodType<T>,
  sent: Promise<Sent>,
  problemSchema: z.ZodType<Problem> = ProblemSchema,
): Promise<T> => {
  const answer = await sent.catch((error: unknown) => {
    if (error instanceof ApiFailure) throw error;
    if (timedOut(error)) {
      throw new ApiFailure({
        kind: "Unreachable",
        detail: `${operation} got no answer within ${REQUEST_LIMIT_MS / 1000} seconds.`,
      });
    }
    throw new ApiFailure({ kind: "Unreachable", detail: `${operation} got no response from the control plane.` });
  });
  if (answer.response.ok) return parsed(operation, schema, answer.data);
  const problem = problemSchema.safeParse(answer.error);
  if (problem.success) {
    throw new ApiFailure({ kind: "Problem", status: answer.response.status, problem: problem.data });
  }
  throw new ApiFailure({
    kind: "Unexpected",
    status: answer.response.status,
    detail: `${operation} answered ${answer.response.status} and did not say why.`,
  });
};

const settleEmpty = (operation: string, sent: Promise<Sent>): Promise<void> =>
  settle(operation, z.unknown(), sent).then(() => undefined);

const putBytes = async (upload: PersonaFileUpload, path: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> => {
  const answer = await fetch(upload.uploadUrl, { method: "PUT", body: bytes }).catch(() => null);
  if (answer === null) {
    throw new ApiFailure({
      kind: "Unreachable",
      detail: `The upload of ${path} got no response from the file store.`,
    });
  }
  if (answer.ok) return;
  throw new ApiFailure({
    kind: "Unexpected",
    status: answer.status,
    detail: `The file store answered ${answer.status} to the upload of ${path}. The persona is unchanged.`,
  });
};

const notSignedIn = (tenantId: string): ApiFailure =>
  new ApiFailure({
    kind: "Problem",
    status: 401,
    problem: {
      code: "SignedOut",
      title: "Not signed in",
      detail: `This browser holds no sign-in for tenant ${tenantId}, or it ended.`,
      fix: "Sign in again.",
    },
  });

const followEvents = (
  apiOrigin: string,
  tenantId: string,
  accessToken: (tenantId: string) => Promise<TokenLookup>,
  listener: EventListener,
): (() => void) => {
  const url = new URL("/v1/events?waitSeconds=0", apiOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let opened = false;
  let delay = RECONNECT_MS;
  const reconnect = (): void => {
    if (stopped) return;
    timer = setTimeout(open, delay);
    delay = Math.min(delay * 2, RECONNECT_CAP_MS);
  };
  const open = async (): Promise<void> => {
    const lookup = await accessToken(tenantId);
    if (stopped || lookup.kind === "None") return;
    if (lookup.kind === "Failed") return reconnect();
    socket = new WebSocket(url, [BEARER_SUBPROTOCOL, `${BEARER_SUBPROTOCOL}.${lookup.token}`]);
    socket.onopen = () => {
      delay = RECONNECT_MS;
      if (opened) listener.onGap();
      opened = true;
    };
    socket.onmessage = (message) => {
      const event = TenantEventSchema.safeParse(JSON.parse(String(message.data)));
      if (event.success) listener.onEvent(event.data);
      else listener.onGap();
    };
    socket.onclose = reconnect;
  };
  void open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
};

export const createHttpApi = (
  apiOrigin: string,
  tenantId: string,
  accessToken: (tenantId: string) => Promise<TokenLookup>,
): TumpelApi => {
  const client = createClient<paths>({
    baseUrl: apiOrigin,
    fetch: (request) => fetch(request, { signal: AbortSignal.timeout(REQUEST_LIMIT_MS) }),
  });
  client.use({
    async onRequest({ request }) {
      const lookup = await accessToken(tenantId);
      if (lookup.kind === "None") throw notSignedIn(tenantId);
      if (lookup.kind === "Failed") throw new ApiFailure(lookup.failure);
      request.headers.set("authorization", `Bearer ${lookup.token}`);
      return request;
    },
  });
  return {
    whoami: () => settle("Identity_whoami", WhoamiSchema, client.GET("/v1/whoami")),
    listHosts: () => settle("Hosts_list", HostSchema.array(), client.GET("/v1/hosts")),
    listHostUsage: () => settle("Hosts_listUsage", ReportedHostUsageSchema.array(), client.GET("/v1/hosts/usage")),
    getHost: (hostId) =>
      settle("Hosts_get", HostSchema, client.GET("/v1/hosts/{hostId}", { params: { path: { hostId } } })),
    revokeHost: (hostId) =>
      settle("Hosts_revoke", HostSchema, client.POST("/v1/hosts/{hostId}/revoke", { params: { path: { hostId } } })),
    mintEnrolmentToken: (expiresInSeconds) =>
      settle(
        "EnrolmentTokens_mint",
        MintedEnrolmentTokenSchema,
        client.POST("/v1/enrolment-tokens", { body: { expiresInSeconds } }),
      ),
    listSessions: (query) =>
      settle("Sessions_list", SessionSchema.array(), client.GET("/v1/sessions", { params: { query } })),
    getSession: (sessionId) =>
      settle(
        "Sessions_get",
        SessionSchema,
        client.GET("/v1/sessions/{sessionId}", { params: { path: { sessionId } } }),
      ),
    startSession: (body) => settle("Sessions_start", StartedSessionSchema, client.POST("/v1/sessions", { body })),
    startSessionFromIssue: (body) =>
      settle(
        "Sessions_startFromIssue",
        StartedSessionFromIssueSchema,
        client.POST("/v1/sessions/from-issue", { body }),
      ),
    stopSession: (sessionId, cancelTurn) =>
      settle(
        "Sessions_stop",
        SessionSchema,
        client.POST("/v1/sessions/{sessionId}/stop", {
          params: { path: { sessionId }, query: cancelTurn ? { cancelTurn } : {} },
        }),
      ),
    archiveSession: (sessionId) =>
      settle(
        "Sessions_archive",
        SessionSchema,
        client.POST("/v1/sessions/{sessionId}/archive", { params: { path: { sessionId } } }),
      ),
    listTurns: (sessionId) =>
      settle(
        "Turns_list",
        TurnSchema.array(),
        client.GET("/v1/sessions/{sessionId}/turns", { params: { path: { sessionId } } }),
      ),
    sendTurn: (sessionId, prompt) =>
      settle(
        "Turns_send",
        TurnSchema,
        client.POST("/v1/sessions/{sessionId}/turns", { params: { path: { sessionId } }, body: { prompt } }),
      ),
    steerTurn: (turnId, prompt) =>
      settle(
        "Turns_steer",
        SteerSchema,
        client.POST("/v1/turns/{turnId}/steers", { params: { path: { turnId } }, body: { prompt } }),
      ),
    readTranscript: (sessionId, query) =>
      settle(
        "Transcripts_read",
        TranscriptPageSchema,
        client.GET("/v1/sessions/{sessionId}/transcript", { params: { path: { sessionId }, query } }),
      ),
    listSnapshots: (sessionId) =>
      settle(
        "Snapshots_list",
        SnapshotSchema.array(),
        client.GET("/v1/sessions/{sessionId}/snapshots", { params: { path: { sessionId } } }),
      ),
    listCredentialHandovers: (sessionId) =>
      settle(
        "Sessions_listCredentialHandovers",
        CredentialHandoverSchema.array(),
        client.GET("/v1/sessions/{sessionId}/credential-handovers", { params: { path: { sessionId } } }),
      ),
    listStopFailures: (sessionId) =>
      settle(
        "Sessions_listStopFailures",
        StopFailureSchema.array(),
        client.GET("/v1/sessions/{sessionId}/stop-failures", { params: { path: { sessionId } } }),
      ),
    listPersonas: () => settle("Personas_list", PersonaSchema.array(), client.GET("/v1/personas")),
    getGitHubConnection: () =>
      settle("GitHubConnections_get", GitHubConnectionSchema, client.GET("/v1/github-connection")),
    listGitHubInstallations: () =>
      settle(
        "GitHubConnections_list",
        GitHubInstallationSchema.array(),
        client.GET("/v1/github-connection/installations"),
      ),
    listRepositories: () =>
      settle(
        "GitHubConnections_listRepositories",
        GitHubRepositorySchema.array(),
        client.GET("/v1/github-connection/repositories"),
      ),
    listIssues: (repository) =>
      settle(
        "GitHubConnections_listIssues",
        GitHubIssueSchema.array(),
        client.GET("/v1/github-connection/repositories/{owner}/{name}/issues", { params: { path: repository } }),
      ),
    listHarnessCatalog: () =>
      settle("HarnessCatalog_list", HarnessCatalogEntrySchema.array(), client.GET("/v1/harnesses")),
    listHarnessPins: () =>
      settle("HarnessCatalog_listPins", EffectiveHarnessVersionSchema.array(), client.GET("/v1/harnesses/pins")),
    pinHarness: (pin) =>
      settle("HarnessCatalog_pin", HarnessPinSchema, client.PUT("/v1/harnesses/pins", { body: pin })),
    unpinHarness: (harness) =>
      settleEmpty(
        "HarnessCatalog_unpin",
        client.DELETE("/v1/harnesses/pins/{harness}", { params: { path: { harness } } }),
      ),
    currentRelease: () => settle("Releases_current", ReleaseManifestSchema, client.GET("/v1/releases/current")),
    getPersona: (personaId) =>
      settle(
        "Personas_get",
        PersonaSchema,
        client.GET("/v1/personas/{personaId}", { params: { path: { personaId } } }),
      ),
    createPersona: (persona) =>
      settle("Personas_create", PersonaSchema, client.POST("/v1/personas", { body: persona })),
    updatePersona: (personaId, persona) =>
      settle(
        "Personas_update",
        PersonaSchema,
        client.PUT("/v1/personas/{personaId}", { params: { path: { personaId } }, body: persona }),
      ),
    deletePersona: (personaId) =>
      settleEmpty("Personas_delete", client.DELETE("/v1/personas/{personaId}", { params: { path: { personaId } } })),
    uploadPersonaFile: (digest, sizeBytes) =>
      settle(
        "Personas_uploadFile",
        PersonaFileUploadSchema,
        client.POST("/v1/personas/file-uploads", { body: { digest, sizeBytes } }),
      ),
    putPersonaFile: putBytes,
    listSecretSets: () => settle("SecretSets_list", SecretSetSchema.array(), client.GET("/v1/secret-sets")),
    getSecretSet: (secretSetId) =>
      settle(
        "SecretSets_get",
        SecretSetSchema,
        client.GET("/v1/secret-sets/{secretSetId}", { params: { path: { secretSetId } } }),
      ),
    createSecretSet: (secretSet) =>
      settle("SecretSets_create", SecretSetSchema, client.POST("/v1/secret-sets", { body: secretSet })),
    updateSecretSet: (secretSetId, secretSet) =>
      settle(
        "SecretSets_update",
        SecretSetSchema,
        client.PUT("/v1/secret-sets/{secretSetId}", { params: { path: { secretSetId } }, body: secretSet }),
      ),
    deleteSecretSet: (secretSetId) =>
      settleEmpty(
        "SecretSets_delete",
        client.DELETE("/v1/secret-sets/{secretSetId}", { params: { path: { secretSetId } } }),
      ),
    startGitHubConnection: (returnUrl, gitHubAccountId) =>
      settle(
        "GitHubConnections_start",
        GitHubInstallStartSchema,
        client.POST("/v1/github-connection/start", {
          params: {
            query: {
              ...(returnUrl === null ? {} : { returnUrl }),
              ...(gitHubAccountId === null ? {} : { gitHubAccountId }),
            },
          },
        }),
      ),
    listConnections: () => settle("Connections_list", ConnectionSummarySchema.array(), client.GET("/v1/connections")),
    getGitHubActionsConnection: () =>
      settle(
        "GitHubActionsConnections_get",
        GitHubActionsConnectionLinkSchema,
        client.GET("/v1/github-actions-connection"),
      ),
    startGitHubActionsConnection: (body) =>
      settle(
        "GitHubActionsConnections_start",
        GitHubActionsConnectionLinkSchema,
        client.POST("/v1/github-actions-connection/start", { body }),
      ),
    deleteGitHubConnection: (installationId) =>
      settleEmpty(
        "GitHubConnections_delete",
        client.DELETE("/v1/github-connection/installations/{installationId}", { params: { path: { installationId } } }),
      ),
    deleteGitHubActionsConnection: () =>
      settleEmpty("GitHubActionsConnections_delete", client.DELETE("/v1/github-actions-connection")),
    getCircleCIConnection: () =>
      settle("CircleCIConnections_get", CircleCIConnectionLinkSchema, client.GET("/v1/circleci-connection")),
    startCircleCIConnection: (body) =>
      settle(
        "CircleCIConnections_start",
        CircleCIConnectionLinkSchema,
        client.POST("/v1/circleci-connection/start", { body }),
      ),
    deleteCircleCIConnection: () => settleEmpty("CircleCIConnections_delete", client.DELETE("/v1/circleci-connection")),
    authorizeCircleCIConnection: () =>
      settle(
        "CircleCIConnections_authorize",
        CircleCIAuthorizationSchema,
        client.POST("/v1/circleci-connection/authorize"),
      ),
    completeCircleCIConnection: (body) =>
      settle(
        "CircleCIConnections_complete",
        CircleCIAuthorizationSchema,
        client.POST("/v1/circleci-connection/complete", { body }),
      ),
    chooseCircleCIOrganization: (body) =>
      settle(
        "CircleCIConnections_choose",
        CircleCIAuthorizationSchema,
        client.POST("/v1/circleci-connection/choose", { body }),
      ),
    listCircleCIProjects: () =>
      settle("CircleCIProjects_list", CircleCIProjectSchema.array(), client.GET("/v1/circleci-projects")),
    getNamespaceConnection: () =>
      settle("NamespaceConnections_get", NamespaceConnectionLinkSchema, client.GET("/v1/namespace-connection")),
    startNamespaceConnection: (body) =>
      settle(
        "NamespaceConnections_start",
        NamespaceConnectionLinkSchema,
        client.POST("/v1/namespace-connection/start", { body }),
      ),
    deleteNamespaceConnection: () =>
      settleEmpty("NamespaceConnections_delete", client.DELETE("/v1/namespace-connection")),
    listPrebuilds: (repository) =>
      settle(
        "Prebuilds_list",
        PrebuildSchema.array(),
        client.GET("/v1/prebuilds", { params: { query: { repository } } }),
      ),
    listLatestPrebuilds: () =>
      settle("Prebuilds_listLatest", PrebuildSchema.array(), client.GET("/v1/prebuilds/latest")),
    startPrebuild: (body) => settle("Prebuilds_start", PrebuildSchema, client.POST("/v1/prebuilds", { body })),
    getPrebuildFailure: (prebuildId) =>
      settle(
        "Prebuilds_getFailure",
        PrebuildFailureSchema,
        client.GET("/v1/prebuilds/{prebuildId}/failure", { params: { path: { prebuildId } } }),
      ),
    previewPrebuild: (body) =>
      settle("Prebuilds_preview", PrebuildPreviewSchema, client.POST("/v1/prebuilds/preview", { body })),
    listPrebuildTemplates: () =>
      settle("PrebuildTemplates_list", PrebuildTemplateSchema.array(), client.GET("/v1/prebuild-templates")),
    getPrebuildTemplate: (prebuildTemplateId, prebuildTemplateVersion) =>
      settle(
        "PrebuildTemplates_get",
        PrebuildTemplateVersionSchema,
        client.GET("/v1/prebuild-templates/{prebuildTemplateId}/versions/{prebuildTemplateVersion}", {
          params: { path: { prebuildTemplateId, prebuildTemplateVersion } },
        }),
      ),
    openTemplatePullRequest: (body) =>
      settle(
        "PrebuildTemplates_openPullRequest",
        PrebuildTemplatePullRequestSchema,
        client.POST("/v1/prebuild-templates/pull-request", { body }),
      ),
    getTemplatePullRequest: (repository) =>
      settle(
        "PrebuildTemplates_getPullRequest",
        PrebuildTemplatePullRequestSchema,
        client.GET("/v1/prebuild-templates/pull-request", { params: { query: { repository } } }),
      ),
    listTenants: () => settle("Identity_listTenants", MembershipSchema.array(), client.GET("/v1/whoami/tenants")),
    listDevices: () => settle("Devices_list", DeviceSchema.array(), client.GET("/v1/devices")),
    revokeDevice: (deviceId) =>
      settleEmpty("Devices_revoke", client.DELETE("/v1/devices/{deviceId}", { params: { path: { deviceId } } })),
    listMembers: () => settle("Members_list", PrincipalSchema.array(), client.GET("/v1/members")),
    removeMember: (principalId) =>
      settleEmpty("Members_remove", client.DELETE("/v1/members/{principalId}", { params: { path: { principalId } } })),
    listInvitations: () => settle("Invitations_list", InvitationSchema.array(), client.GET("/v1/invitations")),
    createInvitation: (body) =>
      settle("Invitations_create", InvitationCreatedSchema, client.POST("/v1/invitations", { body })),
    revokeInvitation: (invitationId) =>
      settleEmpty(
        "Invitations_revoke",
        client.DELETE("/v1/invitations/{invitationId}", { params: { path: { invitationId } } }),
      ),
    listOAuthGrants: () => settle("OAuthGrants_list", OAuthGrantSchema.array(), client.GET("/v1/oauth-grants")),
    planTenantConfig: (body) =>
      settle("TenantConfigs_plan", ConfigPlanSchema, client.POST("/v1/tenant-config/plan", { body })),
    applyTenantConfig: (body) =>
      settle("TenantConfigs_apply", ConfigPlanSchema, client.POST("/v1/tenant-config/apply", { body })),
    startClaudeSetup: (secretSetId, harness) =>
      settle(
        "ClaudeSetups_start",
        ClaudeSetupSchema,
        client.POST("/v1/claude-setups", { body: { secretSetId, harness } }),
      ),
    listClaudeSetups: (secretSetId) =>
      settle(
        "ClaudeSetups_list",
        ClaudeSetupSchema.array(),
        client.GET("/v1/claude-setups", { params: { query: { secretSetId } } }),
      ),
    getClaudeSetup: (claudeSetupId) =>
      settle(
        "ClaudeSetups_get",
        ClaudeSetupSchema,
        client.GET("/v1/claude-setups/{claudeSetupId}", { params: { path: { claudeSetupId } } }),
      ),
    submitClaudeSetupCode: (claudeSetupId, code) =>
      settle(
        "ClaudeSetups_submitCode",
        ClaudeSetupSchema,
        client.POST("/v1/claude-setups/{claudeSetupId}/code", { params: { path: { claudeSetupId } }, body: { code } }),
      ),
    authorizeOpenRouter: (body) =>
      settle(
        "OpenRouterConnections_authorize",
        OpenRouterAuthorizationSchema,
        client.POST("/v1/openrouter-connection/authorize", { body }),
      ),
    getOpenRouterAuthorization: (openRouterAuthorizationId) =>
      settle(
        "OpenRouterConnections_getAuthorization",
        OpenRouterAuthorizationSchema,
        client.GET("/v1/openrouter-connection/authorizations/{openRouterAuthorizationId}", {
          params: { path: { openRouterAuthorizationId } },
        }),
      ),
    metricCatalog: (window) =>
      settle("Metrics_catalog", MetricCatalogSchema, client.GET("/v1/metrics", { params: { query: window } })),
    queryMetric: (metric, query) =>
      settle(
        "Metrics_query",
        MetricSeriesSetSchema,
        client.GET("/v1/metrics/{metric}/series", { params: { path: { metric }, query } }),
      ),
    metricTurns: (metric, query) =>
      settle(
        "Metrics_turns",
        MetricTurnPageSchema,
        client.GET("/v1/metrics/{metric}/turns", { params: { path: { metric }, query } }),
      ),
    getPushKey: () => settle("PushKeys_get", PushKeySchema, client.GET("/v1/push-key")),
    listPushSubscriptions: () =>
      settle("PushSubscriptions_list", PushSubscriptionSchema.array(), client.GET("/v1/push-subscriptions")),
    createPushSubscription: (body) =>
      settle("PushSubscriptions_create", PushSubscriptionSchema, client.POST("/v1/push-subscriptions", { body })),
    deletePushSubscription: (pushSubscriptionId) =>
      settleEmpty(
        "PushSubscriptions_delete",
        client.DELETE("/v1/push-subscriptions/{pushSubscriptionId}", { params: { path: { pushSubscriptionId } } }),
      ),
    listConnectors: () => settle("Connectors_list", ConnectorSchema.array(), client.GET("/v1/connectors")),
    createConnector: (auth, body) =>
      auth === "Static"
        ? settle("StaticConnectors_create", ConnectorSchema, client.POST("/v1/static-connectors", { body }))
        : settle("OAuthConnectors_create", ConnectorSchema, client.POST("/v1/oauth-connectors", { body })),
    updateConnector: ({ connectorId, updatedAt }, body) =>
      settle(
        "Connectors_update",
        ConnectorSchema,
        client.PUT("/v1/connectors/{connectorId}", { params: { path: { connectorId }, query: { updatedAt } }, body }),
      ),
    deleteConnector: ({ connectorId, updatedAt }) =>
      settleEmpty(
        "Connectors_delete",
        client.DELETE("/v1/connectors/{connectorId}", { params: { path: { connectorId }, query: { updatedAt } } }),
      ),
    setConnectorToken: ({ connectorId, updatedAt }, value) =>
      settle(
        "StaticConnectors_setToken",
        ConnectorSchema,
        client.PUT("/v1/static-connectors/{connectorId}/token", {
          params: { path: { connectorId }, query: { updatedAt } },
          body: { value },
        }),
      ),
    clearConnectorCredential: ({ connectorId, updatedAt }) =>
      settle(
        "Connectors_clearCredential",
        ConnectorSchema,
        client.DELETE("/v1/connectors/{connectorId}/credential", {
          params: { path: { connectorId }, query: { updatedAt } },
        }),
      ),
    authorizeConnector: ({ connectorId, updatedAt }) =>
      settle(
        "OAuthConnectors_authorize",
        ConnectorAuthorizationSchema,
        client.POST("/v1/oauth-connectors/{connectorId}/authorize", {
          params: { path: { connectorId }, query: { updatedAt } },
        }),
      ),
    listEvents: (query) =>
      settle("Events_list", EventPageSchema, client.GET("/v1/events", { params: { query } }), EventProblemSchema),
    followEvents: (listener) => followEvents(apiOrigin, tenantId, accessToken, listener),
    listTriggers: () => settle("Triggers_list", TriggerSchema.array(), client.GET("/v1/triggers")),
    getTrigger: (triggerId) =>
      settle(
        "Triggers_get",
        TriggerSchema,
        client.GET("/v1/triggers/{triggerId}", { params: { path: { triggerId } } }),
      ),
    createTrigger: (body) => settle("Triggers_create", TriggerSchema, client.POST("/v1/triggers", { body })),
    updateTrigger: (triggerId, body) =>
      settle(
        "Triggers_update",
        TriggerSchema,
        client.PATCH("/v1/triggers/{triggerId}", { params: { path: { triggerId } }, body }),
      ),
    deleteTrigger: (triggerId) =>
      settleEmpty("Triggers_delete", client.DELETE("/v1/triggers/{triggerId}", { params: { path: { triggerId } } })),
    testTrigger: (body) => settle("Triggers_test", TriggerTestResultSchema, client.POST("/v1/triggers/test", { body })),
  };
};
