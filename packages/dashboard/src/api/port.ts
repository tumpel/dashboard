import type {
  ClaudeSetupSchema,
  CompactTranscriptLineSchema,
  ConfigPlanSchema,
  ConnectionSummarySchema,
  ConnectorAuthorizationSchema,
  ConnectorUpdateSchema,
  CostBasisSchema,
  CredentialHandoverSchema,
  DeviceSchema,
  EffectiveHarnessVersionSchema,
  EventProblemSchema,
  EventQuerySchema,
  GitHubConnectionSchema,
  GitHubInstallationSchema,
  GitHubInstallStartSchema,
  GitHubIssueSchema,
  GitHubRepositoryPathSchema,
  GitHubRepositorySchema,
  HarnessCatalogEntrySchema,
  HarnessPinCreateSchema,
  HarnessPinSchema,
  HostSchema,
  InvitationCreatedSchema,
  InvitationCreateSchema,
  InvitationSchema,
  MembershipSchema,
  MetricBucketSchema,
  MetricCatalogSchema,
  MetricKindSchema,
  MetricSeriesQuerySchema,
  MetricSeriesSetSchema,
  MetricTurnPageSchema,
  MetricTurnQuerySchema,
  MetricWindowSchema,
  MintedEnrolmentTokenSchema,
  OAuthGrantSchema,
  OpenRouterAuthorizationStartSchema,
  PersonaCreateSchema,
  PersonaFileUploadSchema,
  PersonaSchema,
  PersonaUpdateSchema,
  PrebuildFailureSchema,
  PrebuildPreviewRequestSchema,
  PrebuildPreviewSchema,
  PrebuildSchema,
  PrebuildStartSchema,
  PrebuildTemplatePullRequestOpenSchema,
  PrebuildTemplatePullRequestSchema,
  PrebuildTemplateSchema,
  PrebuildTemplateVersionSchema,
  PrincipalSchema,
  PushKeySchema,
  PushSubscriptionCreateSchema,
  PushSubscriptionSchema,
  ReleaseManifestSchema,
  ReportedHostUsageSchema,
  SecretSetCreateSchema,
  SecretSetSchema,
  SecretSetUpdateSchema,
  SessionListQuerySchema,
  SessionStartFromIssueSchema,
  SessionStartSchema,
  SnapshotSchema,
  StaticConnectorCreateSchema,
  SteerSchema,
  StopFailureSchema,
  TenantConfigApplySchema,
  TenantConfigPlanRequestSchema,
  TenantConfigSchema,
  TranscriptQuerySchema,
  TriggerCreateSchema,
  TriggerPatchSchema,
  TriggerSchema,
  TriggerTestResultSchema,
  TriggerTestSchema,
  WhoamiSchema,
} from "@tumpel/schemas";
import type { z } from "zod";
import type {
  ConnectorViewSchema,
  EventPageViewSchema,
  OpenRouterAuthorizationViewSchema,
  SessionViewSchema,
  StartedSessionFromIssueViewSchema,
  StartedSessionViewSchema,
  TranscriptPageViewSchema,
  TurnViewSchema,
} from "./responses";

export type Host = z.infer<typeof HostSchema>;
export type TenantEvent = EventPage["events"][number];
export type EventQuery = z.infer<typeof EventQuerySchema>;
export type EventPage = z.infer<typeof EventPageViewSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type TriggerCreate = z.infer<typeof TriggerCreateSchema>;
export type TriggerPatch = z.infer<typeof TriggerPatchSchema>;
export type TriggerSource = Trigger["source"];
export type TriggerEvent = TriggerSource["event"];
export type TriggerCondition = TriggerSource["conditions"][number];
export type TriggerTest = z.infer<typeof TriggerTestSchema>;
export type TriggerTestResult = z.infer<typeof TriggerTestResultSchema>;
export type TriggerStartRefused = Extract<TenantEvent, { event: "TriggerStartRefused" }>;

export interface EventListener {
  onEvent(event: TenantEvent): void;
  onGap(): void;
}
export type ReportedHostUsage = z.infer<typeof ReportedHostUsageSchema>;
export type Session = z.infer<typeof SessionViewSchema>;
export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;
export type Whoami = z.infer<typeof WhoamiSchema>;
export type MintedEnrolmentToken = z.infer<typeof MintedEnrolmentTokenSchema>;
export type Problem = z.infer<typeof EventProblemSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type SessionStart = z.infer<typeof SessionStartSchema>;
export type StartedSession = z.infer<typeof StartedSessionViewSchema>;
export type SessionStartFromIssue = z.infer<typeof SessionStartFromIssueSchema>;
export type StartedSessionFromIssue = z.infer<typeof StartedSessionFromIssueViewSchema>;
export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;
export type GitHubRepositoryPath = z.infer<typeof GitHubRepositoryPathSchema>;
export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;
export type Turn = z.infer<typeof TurnViewSchema>;
export type Steer = z.infer<typeof SteerSchema>;
export type TranscriptQuery = z.infer<typeof TranscriptQuerySchema>;
export type TranscriptPage = z.infer<typeof TranscriptPageViewSchema>;
export type TranscriptText = z.infer<typeof CompactTranscriptLineSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type CredentialHandover = z.infer<typeof CredentialHandoverSchema>;
export type StopFailure = z.infer<typeof StopFailureSchema>;
export type GitHubInstallation = z.infer<typeof GitHubInstallationSchema>;
export type GitHubConnection = z.infer<typeof GitHubConnectionSchema>;
export type HarnessCatalogEntry = z.infer<typeof HarnessCatalogEntrySchema>;
export type HarnessPin = z.infer<typeof HarnessPinSchema>;
export type EffectiveHarnessVersion = z.infer<typeof EffectiveHarnessVersionSchema>;
export type HarnessPinCreate = z.infer<typeof HarnessPinCreateSchema>;
export type Harness = HarnessPin["harness"];
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;
export type PersonaCreate = z.infer<typeof PersonaCreateSchema>;
export type PersonaUpdate = z.infer<typeof PersonaUpdateSchema>;
export type PersonaFileWrite = NonNullable<PersonaCreate["files"]>[number];
export type PersonaFileUpload = z.infer<typeof PersonaFileUploadSchema>;
export type SecretSet = z.infer<typeof SecretSetSchema>;
export type SecretKey = SecretSet["keys"][number];
export type SecretSetCreate = z.infer<typeof SecretSetCreateSchema>;
export type SecretSetUpdate = z.infer<typeof SecretSetUpdateSchema>;
export type SecretValue = SecretSetCreate["secrets"][number];
export type SecretMemberUpdate = SecretSetUpdate["secrets"][number];
export type ModelProvider = HarnessCatalogEntry["credentials"][number]["provider"];
export type GitHubInstallStart = z.infer<typeof GitHubInstallStartSchema>;
export type ConnectionSummary = z.infer<typeof ConnectionSummarySchema>;
export type Prebuild = z.infer<typeof PrebuildSchema>;
export type PrebuildStart = z.infer<typeof PrebuildStartSchema>;
export type PrebuildFailure = z.infer<typeof PrebuildFailureSchema>;
export type PrebuildPreviewRequest = z.infer<typeof PrebuildPreviewRequestSchema>;
export type PrebuildPreview = z.infer<typeof PrebuildPreviewSchema>;
export type PrebuildPreviewCommand = PrebuildPreview["commands"][number];
export type PrebuildTemplate = z.infer<typeof PrebuildTemplateSchema>;
export type PrebuildTemplateVersionSummary = PrebuildTemplate["versions"][number];
export type PrebuildTemplateVersion = z.infer<typeof PrebuildTemplateVersionSchema>;
export type PrebuildTemplatePullRequestOpen = z.infer<typeof PrebuildTemplatePullRequestOpenSchema>;
export type PrebuildTemplatePullRequest = z.infer<typeof PrebuildTemplatePullRequestSchema>;
export type OAuthGrant = z.infer<typeof OAuthGrantSchema>;
export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type TenantConfigPlanRequest = z.infer<typeof TenantConfigPlanRequestSchema>;
export type TenantConfigApply = z.infer<typeof TenantConfigApplySchema>;
export type ConfigPlan = z.infer<typeof ConfigPlanSchema>;
export type ConfigChange = ConfigPlan["changes"][number];
export type ClaudeSetup = z.infer<typeof ClaudeSetupSchema>;
export type ClaudeSetupStatus = ClaudeSetup["status"];
export type ClaudeSetupHarness = ClaudeSetup["harness"];
export type ClaudeSetupFailureReason = Extract<ClaudeSetupStatus, { state: "Failed" }>["reason"];
export type OpenRouterAuthorization = z.infer<typeof OpenRouterAuthorizationViewSchema>;
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
export type MetricCatalog = z.infer<typeof MetricCatalogSchema>;
export type MetricEntry = MetricCatalog["metrics"][number];
export type MetricSeriesQuery = z.infer<typeof MetricSeriesQuerySchema>;
export type MetricSeriesSet = z.infer<typeof MetricSeriesSetSchema>;
export type MetricSeries = MetricSeriesSet["series"][number];
export type MetricPoint = MetricSeries["points"][number];
export type MetricTurnQuery = z.infer<typeof MetricTurnQuerySchema>;
export type MetricTurnPage = z.infer<typeof MetricTurnPageSchema>;
export type MetricTurnPoint = MetricTurnPage["points"][number];

export type Device = z.infer<typeof DeviceSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type Member = z.infer<typeof PrincipalSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type InvitationCreate = z.infer<typeof InvitationCreateSchema>;
export type InvitationCreated = z.infer<typeof InvitationCreatedSchema>;
export type Role = Member["role"];
export type Connector = z.infer<typeof ConnectorViewSchema>;
export type ConnectorStatus = Connector["status"];
export type ConnectorCreate = z.infer<typeof StaticConnectorCreateSchema>;
export type ConnectorUpdate = z.infer<typeof ConnectorUpdateSchema>;
export type ConnectorAuthorization = z.infer<typeof ConnectorAuthorizationSchema>;
export type PushKey = z.infer<typeof PushKeySchema>;
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;
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
  listSessions(query: SessionListQuery): Promise<Session[]>;
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
