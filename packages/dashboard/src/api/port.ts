import type {
  ClaudeSetupHarnessSchema,
  ConnectorUpdateSchema,
  CostBasisSchema,
  decode,
  EventProblemSchema,
  EventQuerySchema,
  GitHubRepositoryPathSchema,
  HarnessPinCreateSchema,
  InvitationCreateSchema,
  MetricBucketSchema,
  MetricKindSchema,
  MetricSeriesQuerySchema,
  MetricTurnQuerySchema,
  MetricWindowSchema,
  ModelProviderSchema,
  OpenRouterAuthorizationStartSchema,
  PersonaCreateSchema,
  PersonaUpdateSchema,
  PrebuildPreviewRequestSchema,
  PrebuildStartSchema,
  PrebuildTemplatePullRequestOpenSchema,
  PushSubscriptionCreateSchema,
  SecretSetCreateSchema,
  SecretSetUpdateSchema,
  SessionListQuerySchema,
  SessionStartFromIssueSchema,
  SessionStartSchema,
  StaticConnectorCreateSchema,
  TenantConfigApplySchema,
  TenantConfigPlanRequestSchema,
  TenantConfigSchema,
  TranscriptQuerySchema,
  TriggerCreateSchema,
  TriggerPatchSchema,
  TriggerTestSchema,
} from "@tumpel/schemas";
import type { z } from "zod";

export type DecodeKey = Parameters<typeof decode>[0];
export type Decoded<K extends DecodeKey> = Extract<ReturnType<typeof decode<K>>, { success: true }>["data"];

export type Host = Decoded<"HostSchema">;
export type TenantEvent = Exclude<Decoded<"TenantEventSchema">, { event: "Unrecognised" }>;
export type EventQuery = z.infer<typeof EventQuerySchema>;
export type EventPage = Decoded<"EventPageSchema">;
export type Trigger = Decoded<"TriggerSchema">;
export type TriggerCreate = z.infer<typeof TriggerCreateSchema>;
export type TriggerPatch = z.infer<typeof TriggerPatchSchema>;
export type TriggerSource = TriggerCreate["source"];
export type TriggerEvent = TriggerSource["event"];
export type TriggerCondition = TriggerSource["conditions"][number];
export type TriggerTest = z.infer<typeof TriggerTestSchema>;
export type TriggerTestResult = Decoded<"TriggerTestResultSchema">;
export type TriggerStartRefused = Decoded<"TriggerStartRefusedEventSchema">;

export interface EventListener {
  onEvent(event: TenantEvent): void;
  onGap(): void;
}
export type ReportedHostUsage = Decoded<"ReportedHostUsageSchema">;
export type Session = Decoded<"SessionSchema">;
export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;
export type Whoami = Decoded<"WhoamiSchema">;
export type MintedEnrolmentToken = Decoded<"MintedEnrolmentTokenSchema">;
export type Problem = z.infer<typeof EventProblemSchema>;
export type Persona = Decoded<"PersonaSchema">;
export type SessionStart = z.infer<typeof SessionStartSchema>;
export type StartedSession = Decoded<"StartedSessionSchema">;
export type SessionStartFromIssue = z.infer<typeof SessionStartFromIssueSchema>;
export type StartedSessionFromIssue = Decoded<"StartedSessionFromIssueSchema">;
export type GitHubRepository = Decoded<"GitHubRepositorySchema">;
export type GitHubRepositoryPath = z.infer<typeof GitHubRepositoryPathSchema>;
export type GitHubIssue = Decoded<"GitHubIssueSchema">;
export type Turn = Decoded<"TurnSchema">;
export type Steer = Decoded<"SteerSchema">;
export type TranscriptQuery = z.infer<typeof TranscriptQuerySchema>;
export type TranscriptPage = Decoded<"TranscriptPageSchema">;
export type TranscriptText = Decoded<"CompactTranscriptLineSchema">;
export type Snapshot = Decoded<"SnapshotSchema">;
export type CredentialHandover = Decoded<"CredentialHandoverSchema">;
export type StopFailure = Decoded<"StopFailureSchema">;
export type GitHubInstallation = Decoded<"GitHubInstallationSchema">;
export type GitHubConnection = Decoded<"GitHubConnectionSchema">;
export type HarnessCatalogEntry = Decoded<"HarnessCatalogEntrySchema">;
export type HarnessPin = Decoded<"HarnessPinSchema">;
export type EffectiveHarnessVersion = Decoded<"EffectiveHarnessVersionSchema">;
export type HarnessPinCreate = z.infer<typeof HarnessPinCreateSchema>;
export type Harness = HarnessPinCreate["harness"];
export type ReleaseManifest = Decoded<"ReleaseManifestSchema">;
export type PersonaCreate = z.infer<typeof PersonaCreateSchema>;
export type PersonaUpdate = z.infer<typeof PersonaUpdateSchema>;
export type PersonaFileWrite = NonNullable<PersonaCreate["files"]>[number];
export type PersonaFileUpload = Decoded<"PersonaFileUploadSchema">;
export type SecretSet = Decoded<"SecretSetSchema">;
export type SecretKey = SecretSet["keys"][number];
export type SecretSetCreate = z.infer<typeof SecretSetCreateSchema>;
export type SecretSetUpdate = z.infer<typeof SecretSetUpdateSchema>;
export type SecretValue = SecretSetCreate["secrets"][number];
export type SecretMemberUpdate = SecretSetUpdate["secrets"][number];
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type GitHubInstallStart = Decoded<"GitHubInstallStartSchema">;
export type ConnectionSummary = Decoded<"ConnectionSummarySchema">;
export type Prebuild = Decoded<"PrebuildSchema">;
export type PrebuildStart = z.infer<typeof PrebuildStartSchema>;
export type PrebuildFailure = Decoded<"PrebuildFailureSchema">;
export type PrebuildPreviewRequest = z.infer<typeof PrebuildPreviewRequestSchema>;
export type PrebuildPreview = Decoded<"PrebuildPreviewSchema">;
export type PrebuildPreviewCommand = PrebuildPreview["commands"][number];
export type PrebuildTemplate = Decoded<"PrebuildTemplateSchema">;
export type PrebuildTemplateVersionSummary = PrebuildTemplate["versions"][number];
export type PrebuildTemplateVersion = Decoded<"PrebuildTemplateVersionSchema">;
export type PrebuildTemplatePullRequestOpen = z.infer<typeof PrebuildTemplatePullRequestOpenSchema>;
export type PrebuildTemplatePullRequest = Decoded<"PrebuildTemplatePullRequestSchema">;
export type OAuthGrant = Decoded<"OAuthGrantSchema">;
export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type TenantConfigPlanRequest = z.infer<typeof TenantConfigPlanRequestSchema>;
export type TenantConfigApply = z.infer<typeof TenantConfigApplySchema>;
export type ConfigPlan = Decoded<"ConfigPlanSchema">;
export type ConfigChange = ConfigPlan["changes"][number];
export type ClaudeSetup = Decoded<"ClaudeSetupSchema">;
export type ClaudeSetupStatus = ClaudeSetup["status"];
export type ClaudeSetupHarness = z.infer<typeof ClaudeSetupHarnessSchema>;
export type ClaudeSetupFailureReason = Extract<ClaudeSetupStatus, { state: "Failed" }>["reason"];
export type OpenRouterAuthorization = Decoded<"OpenRouterAuthorizationSchema">;
export type OpenRouterAuthorizationStart = z.infer<typeof OpenRouterAuthorizationStartSchema>;
export type OpenRouterAuthorizationStatus = OpenRouterAuthorization["status"];
export type OpenRouterAuthorizationFailureReason = Extract<
  OpenRouterAuthorizationStatus,
  { state: "Failed" }
>["reason"];

export type CostBasis = z.infer<typeof CostBasisSchema>;
export type MetricBucket = z.infer<typeof MetricBucketSchema>;
export type MetricKind = z.infer<typeof MetricKindSchema>;
export type MetricWindow = z.infer<typeof MetricWindowSchema>;
export type MetricCatalog = Decoded<"MetricCatalogSchema">;
export type MetricEntry = MetricCatalog["metrics"][number];
export type MetricSeriesQuery = z.infer<typeof MetricSeriesQuerySchema>;
export type MetricSeriesSet = Decoded<"MetricSeriesSetSchema">;
export type MetricSeries = MetricSeriesSet["series"][number];
export type MetricPoint = MetricSeries["points"][number];
export type MetricTurnQuery = z.infer<typeof MetricTurnQuerySchema>;
export type MetricTurnPage = Decoded<"MetricTurnPageSchema">;
export type MetricTurnPoint = MetricTurnPage["points"][number];

export type Device = Decoded<"DeviceSchema">;
export type Membership = Decoded<"MembershipSchema">;
export type Member = Decoded<"PrincipalSchema">;
export type Invitation = Decoded<"InvitationSchema">;
export type InvitationCreate = z.infer<typeof InvitationCreateSchema>;
export type InvitationCreated = Decoded<"InvitationCreatedSchema">;
export type Role = InvitationCreate["role"];
export type Connector = Decoded<"ConnectorSchema">;
export type ConnectorStatus = Connector["status"];
export type ConnectorCreate = z.infer<typeof StaticConnectorCreateSchema>;
export type ConnectorUpdate = z.infer<typeof ConnectorUpdateSchema>;
export type ConnectorAuthorization = Decoded<"ConnectorAuthorizationSchema">;
export type PushKey = Decoded<"PushKeySchema">;
export type PushSubscription = Decoded<"PushSubscriptionSchema">;
export type PushSubscriptionCreate = z.infer<typeof PushSubscriptionCreateSchema>;

export type Failure =
  | { kind: "Problem"; status: number; problem: Problem }
  | { kind: "Unreachable"; detail: string }
  | { kind: "Unexpected"; status: number; detail: string }
  | { kind: "OutOfStep"; operation: string; detail: string };

export class ApiFailure extends Error {
  readonly failure: Failure;

  constructor(failure: Failure) {
    super(failure.kind === "Problem" ? failure.problem.title : failure.detail);
    this.failure = failure;
  }
}

export const failureOf = (error: unknown): Failure =>
  error instanceof ApiFailure
    ? error.failure
    : { kind: "Unexpected", status: 0, detail: error instanceof Error ? error.message : String(error) };

export const refusedAlone = (error: unknown): error is ApiFailure =>
  error instanceof ApiFailure &&
  error.failure.kind === "Problem" &&
  error.failure.status !== 401 &&
  error.failure.status !== 403;

export const isSignedOut = (error: unknown): boolean =>
  error instanceof ApiFailure && error.failure.kind === "Problem" && error.failure.status === 401;

export interface TumpelApi {
  whoami(): Promise<Whoami>;
  listHosts(): Promise<Host[]>;
  listHostUsage(): Promise<ReportedHostUsage[]>;
  getHost(hostId: string): Promise<Host>;
  revokeHost(hostId: string): Promise<Host>;
  mintEnrolmentToken(expiresInSeconds: number): Promise<MintedEnrolmentToken>;
  listSessions(query: Omit<SessionListQuery, "limit" | "after">): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session>;
  startSession(body: SessionStart): Promise<StartedSession>;
  startSessionFromIssue(body: SessionStartFromIssue): Promise<StartedSessionFromIssue>;
  stopSession(sessionId: string, cancelTurn: boolean): Promise<Session>;
  archiveSession(sessionId: string): Promise<Session>;
  listTurns(sessionId: string): Promise<Turn[]>;
  sendTurn(sessionId: string, prompt: string): Promise<Turn>;
  steerTurn(turnId: string, prompt: string): Promise<Steer>;
  readTranscript(sessionId: string, query: TranscriptQuery): Promise<TranscriptPage>;
  listSnapshots(sessionId: string): Promise<Snapshot[]>;
  listCredentialHandovers(sessionId: string): Promise<CredentialHandover[]>;
  listStopFailures(sessionId: string): Promise<StopFailure[]>;
  listPersonas(): Promise<Persona[]>;
  getGitHubConnection(): Promise<GitHubConnection>;
  listGitHubInstallations(): Promise<GitHubInstallation[]>;
  listRepositories(): Promise<GitHubRepository[]>;
  listIssues(repository: GitHubRepositoryPath): Promise<GitHubIssue[]>;
  listHarnessCatalog(): Promise<HarnessCatalogEntry[]>;
  listHarnessPins(): Promise<EffectiveHarnessVersion[]>;
  pinHarness(pin: HarnessPinCreate): Promise<HarnessPin>;
  unpinHarness(harness: Harness): Promise<void>;
  currentRelease(): Promise<ReleaseManifest>;
  getPersona(personaId: string): Promise<Persona>;
  createPersona(persona: PersonaCreate): Promise<Persona>;
  updatePersona(personaId: string, persona: PersonaUpdate): Promise<Persona>;
  deletePersona(personaId: string): Promise<void>;
  uploadPersonaFile(digest: string, sizeBytes: number): Promise<PersonaFileUpload>;
  putPersonaFile(upload: PersonaFileUpload, path: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  listSecretSets(): Promise<SecretSet[]>;
  getSecretSet(secretSetId: string): Promise<SecretSet>;
  createSecretSet(secretSet: SecretSetCreate): Promise<SecretSet>;
  updateSecretSet(secretSetId: string, secretSet: SecretSetUpdate): Promise<SecretSet>;
  deleteSecretSet(secretSetId: string): Promise<void>;
  startGitHubConnection(returnUrl: string | null, gitHubAccountId: number | null): Promise<GitHubInstallStart>;
  deleteGitHubConnection(installationId: number): Promise<void>;
  listConnections(): Promise<ConnectionSummary[]>;
  listPrebuilds(repository: string): Promise<Prebuild[]>;
  listLatestPrebuilds(): Promise<Prebuild[]>;
  startPrebuild(body: PrebuildStart): Promise<Prebuild>;
  getPrebuildFailure(prebuildId: string): Promise<PrebuildFailure>;
  previewPrebuild(body: PrebuildPreviewRequest): Promise<PrebuildPreview>;
  listPrebuildTemplates(): Promise<PrebuildTemplate[]>;
  getPrebuildTemplate(prebuildTemplateId: string, prebuildTemplateVersion: number): Promise<PrebuildTemplateVersion>;
  openTemplatePullRequest(body: PrebuildTemplatePullRequestOpen): Promise<PrebuildTemplatePullRequest>;
  getTemplatePullRequest(repository: string): Promise<PrebuildTemplatePullRequest>;
  listTenants(): Promise<Membership[]>;
  listDevices(): Promise<Device[]>;
  revokeDevice(deviceId: string): Promise<void>;
  listMembers(): Promise<Member[]>;
  removeMember(principalId: string): Promise<void>;
  listInvitations(): Promise<Invitation[]>;
  createInvitation(invitation: InvitationCreate): Promise<InvitationCreated>;
  revokeInvitation(invitationId: string): Promise<void>;
  listOAuthGrants(): Promise<OAuthGrant[]>;
  planTenantConfig(body: TenantConfigPlanRequest): Promise<ConfigPlan>;
  applyTenantConfig(body: TenantConfigApply): Promise<ConfigPlan>;
  startClaudeSetup(secretSetId: string, harness: ClaudeSetupHarness): Promise<ClaudeSetup>;
  listClaudeSetups(secretSetId: string): Promise<ClaudeSetup[]>;
  getClaudeSetup(claudeSetupId: string): Promise<ClaudeSetup>;
  submitClaudeSetupCode(claudeSetupId: string, code: string): Promise<ClaudeSetup>;
  authorizeOpenRouter(body: OpenRouterAuthorizationStart): Promise<OpenRouterAuthorization>;
  getOpenRouterAuthorization(openRouterAuthorizationId: string): Promise<OpenRouterAuthorization>;
  metricCatalog(window: MetricWindow): Promise<MetricCatalog>;
  queryMetric(metric: string, query: MetricSeriesQuery): Promise<MetricSeriesSet>;
  metricTurns(metric: string, query: MetricTurnQuery): Promise<MetricTurnPage>;
  getPushKey(): Promise<PushKey>;
  listPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(body: PushSubscriptionCreate): Promise<PushSubscription>;
  deletePushSubscription(pushSubscriptionId: string): Promise<void>;
  listConnectors(): Promise<Connector[]>;
  createConnector(auth: Connector["auth"], body: ConnectorCreate): Promise<Connector>;
  updateConnector(connector: Connector, body: ConnectorUpdate): Promise<Connector>;
  deleteConnector(connector: Connector): Promise<void>;
  setConnectorToken(connector: Connector, value: string): Promise<Connector>;
  clearConnectorCredential(connector: Connector): Promise<Connector>;
  authorizeConnector(connector: Connector): Promise<ConnectorAuthorization>;
  listEvents(query: EventQuery): Promise<EventPage>;
  followEvents(listener: EventListener): () => void;
  listTriggers(): Promise<Trigger[]>;
  getTrigger(triggerId: string): Promise<Trigger>;
  createTrigger(trigger: TriggerCreate): Promise<Trigger>;
  updateTrigger(triggerId: string, patch: TriggerPatch): Promise<Trigger>;
  deleteTrigger(triggerId: string): Promise<void>;
  testTrigger(test: TriggerTest): Promise<TriggerTestResult>;
}

export interface SignedInTenant {
  tenantId: string;
  tenantName: string;
  email: string;
}

export type SignInOutcome = { ok: true; tenantId: string; returnPath: string } | { ok: false; failure: Failure };

export interface AuthPort {
  signIn(returnPath: string): Promise<Failure>;
  finishSignIn(params: URLSearchParams): Promise<SignInOutcome>;
  signedInTenants(): SignedInTenant[];
  signOut(): Promise<Failure | null>;
}

export interface DashboardPorts {
  apiFor(tenantId: string): TumpelApi;
  apiOrigin: string;
  auth: AuthPort;
  reportIssueUrl: string;
  now(): number;
}
