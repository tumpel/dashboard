import {
  skipToken,
  type UseMutationResult,
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  ClaudeSetup,
  ClaudeSetupHarness,
  GitHubRepositoryPath,
  MetricBucket,
  MetricSeriesQuery,
  MetricTurnPoint,
  MetricWindow,
} from "./api/port";
import { nextSetupReadIn } from "./claude-setup-reads";
import { useTenantApi } from "./context";
import { COST_METRIC, turnsQuery } from "./metrics";

export const keys = {
  whoami: (tenantId: string) => [tenantId, "whoami"] as const,
  hosts: (tenantId: string) => [tenantId, "hosts"] as const,
  host: (tenantId: string, hostId: string) => [tenantId, "hosts", hostId] as const,
  hostUsage: (tenantId: string) => [tenantId, "hostUsage"] as const,
  sessions: (tenantId: string) => [tenantId, "sessions"] as const,
  harnessCatalog: (tenantId: string) => [tenantId, "harnessCatalog"] as const,
  harnessPins: (tenantId: string) => [tenantId, "harnessPins"] as const,
  release: (tenantId: string) => [tenantId, "release"] as const,
  personas: (tenantId: string) => [tenantId, "personas"] as const,
  persona: (tenantId: string, personaId: string) => [tenantId, "personas", personaId] as const,
  secretSets: (tenantId: string) => [tenantId, "secretSets"] as const,
  secretSet: (tenantId: string, secretSetId: string) => [tenantId, "secretSets", secretSetId] as const,
  session: (tenantId: string, sessionId: string) => [tenantId, "sessions", sessionId] as const,
  turns: (tenantId: string, sessionId: string) => [tenantId, "sessions", sessionId, "turns"] as const,
  turnFailure: (tenantId: string, turnId: string) => [tenantId, "turnFailures", turnId] as const,
  transcript: (tenantId: string, sessionId: string, turnId: string, compact: boolean) =>
    [tenantId, "sessions", sessionId, "transcript", turnId, compact] as const,
  snapshots: (tenantId: string, sessionId: string) => [tenantId, "sessions", sessionId, "snapshots"] as const,
  handovers: (tenantId: string, sessionId: string) => [tenantId, "sessions", sessionId, "handovers"] as const,
  stopFailures: (tenantId: string, sessionId: string) => [tenantId, "sessions", sessionId, "stopFailures"] as const,
  github: (tenantId: string) => [tenantId, "githubConnection"] as const,
  githubInstallations: (tenantId: string) => [tenantId, "githubInstallations"] as const,
  githubAccounts: (tenantId: string) => [tenantId, "githubAccounts"] as const,
  oauthGrants: (tenantId: string) => [tenantId, "oauthGrants"] as const,
  claudeSetup: (tenantId: string, claudeSetupId: string) => [tenantId, "claudeSetups", claudeSetupId] as const,
  claudeSetups: (tenantId: string, secretSetId: string) =>
    [tenantId, "secretSets", secretSetId, "claudeSetups"] as const,
  repositories: (tenantId: string) => [tenantId, "githubRepositories"] as const,
  issues: (tenantId: string, owner: string, name: string) =>
    [tenantId, "githubRepositories", owner, name, "issues"] as const,
};

export interface ClaudeSetupFlow {
  tenantId: string;
  harness: ClaudeSetupHarness;
  start: UseMutationResult<ClaudeSetup, Error, void>;
  read: UseQueryResult<ClaudeSetup>;
  resume: UseQueryResult<ClaudeSetup[]>;
  active: boolean;
  close: () => void;
}

type ClaudeSetupChoice = { kind: "Resuming" } | { kind: "Idle" } | { kind: "Chosen"; claudeSetupId: string };

export const useClaudeSetup = (
  tenantId: string,
  secretSetId: string,
  harness: ClaudeSetupHarness = "ClaudeCode",
): ClaudeSetupFlow => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<ClaudeSetupChoice>({ kind: "Resuming" });
  const claudeSetupId = choice.kind === "Chosen" ? choice.claudeSetupId : null;
  const resume = useQuery({
    queryKey: keys.claudeSetups(tenantId, secretSetId),
    queryFn: () => api.listClaudeSetups(secretSetId),
    enabled: choice.kind === "Resuming",
  });
  const running = resume.data?.find((setup) => setup.harness === harness);
  useEffect(() => {
    if (choice.kind !== "Resuming" || running === undefined) return;
    queryClient.setQueryData(keys.claudeSetup(tenantId, running.claudeSetupId), running);
    setChoice({ kind: "Chosen", claudeSetupId: running.claudeSetupId });
  }, [choice, running, queryClient, tenantId]);
  const start = useMutation({
    onMutate: () => setChoice({ kind: "Idle" }),
    mutationFn: () => api.startClaudeSetup(secretSetId, harness),
    onSuccess: (setup) => {
      queryClient.setQueryData(keys.claudeSetup(tenantId, setup.claudeSetupId), setup);
      setChoice({ kind: "Chosen", claudeSetupId: setup.claudeSetupId });
    },
  });
  const read = useQuery({
    queryKey: keys.claudeSetup(tenantId, claudeSetupId ?? ""),
    queryFn: claudeSetupId === null ? skipToken : () => api.getClaudeSetup(claudeSetupId),
    refetchInterval: (query) => nextSetupReadIn(query.state),
    refetchIntervalInBackground: true,
  });
  return {
    tenantId,
    harness,
    start,
    read,
    resume,
    active: !start.isIdle || claudeSetupId !== null || (choice.kind === "Resuming" && resume.isError),
    close: () => {
      start.reset();
      setChoice({ kind: "Idle" });
    },
  };
};

export const useOAuthGrants = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.oauthGrants(tenantId), queryFn: () => api.listOAuthGrants() });
};

export const useWhoami = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.whoami(tenantId),
    queryFn: () => api.whoami(),
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useOwner = (tenantId: string): boolean => useWhoami(tenantId).data?.principal.role === "Owner";

export const useHosts = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.hosts(tenantId), queryFn: () => api.listHosts() });
};

export const useHost = (tenantId: string, hostId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.host(tenantId, hostId), queryFn: () => api.getHost(hostId) });
};

export const useHostUsage = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.hostUsage(tenantId), queryFn: () => api.listHostUsage() });
};

export const useSessions = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.sessions(tenantId), queryFn: () => api.listSessions() });
};

export const useSession = (tenantId: string, sessionId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.session(tenantId, sessionId), queryFn: () => api.getSession(sessionId) });
};

export const useTurns = (tenantId: string, sessionId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.turns(tenantId, sessionId), queryFn: () => api.listTurns(sessionId) });
};

export const useTurnFailure = (tenantId: string, turnId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.turnFailure(tenantId, turnId),
    queryFn: () => api.getTurnFailure(turnId),
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useSnapshots = (tenantId: string, sessionId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.snapshots(tenantId, sessionId),
    queryFn: () => api.listSnapshots(sessionId),
  });
};

export const useCredentialHandovers = (tenantId: string, sessionId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.handovers(tenantId, sessionId),
    queryFn: () => api.listCredentialHandovers(sessionId),
  });
};

export const useStopFailures = (tenantId: string, sessionId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.stopFailures(tenantId, sessionId),
    queryFn: () => api.listStopFailures(sessionId),
  });
};

export const useHarnessCatalog = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.harnessCatalog(tenantId), queryFn: () => api.listHarnessCatalog() });
};

export const useHarnessPins = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.harnessPins(tenantId), queryFn: () => api.listHarnessPins() });
};

export const useCurrentRelease = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.release(tenantId), queryFn: () => api.currentRelease() });
};

export const usePersonas = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.personas(tenantId), queryFn: () => api.listPersonas() });
};

export const useGitHubConnection = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.github(tenantId), queryFn: () => api.getGitHubConnection() });
};

export const useGitHubInstallations = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.githubInstallations(tenantId), queryFn: () => api.listGitHubInstallations() });
};

export const useRepositories = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.repositories(tenantId), queryFn: () => api.listRepositories() });
};

export const useIssues = (tenantId: string, repository: GitHubRepositoryPath | null) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.issues(tenantId, repository?.owner ?? "", repository?.name ?? ""),
    queryFn: repository === null ? skipToken : () => api.listIssues(repository),
  });
};

export const usePersona = (tenantId: string, personaId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.persona(tenantId, personaId),
    queryFn: () => api.getPersona(personaId),
    refetchOnWindowFocus: false,
  });
};

export const useSecretSets = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: keys.secretSets(tenantId), queryFn: () => api.listSecretSets() });
};

export const useSecretSet = (tenantId: string, secretSetId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.secretSet(tenantId, secretSetId),
    queryFn: () => api.getSecretSet(secretSetId),
    refetchOnWindowFocus: false,
  });
};

export const connectionKeys = {
  list: (tenantId: string) => [tenantId, "connections"] as const,
  gitHubActions: (tenantId: string) => [tenantId, "connections", "GitHubActions"] as const,
  circleCI: (tenantId: string) => [tenantId, "connections", "CircleCI"] as const,
  circleCIProjects: (tenantId: string) => [tenantId, "connections", "CircleCI", "projects"] as const,
  namespace: (tenantId: string) => [tenantId, "connections", "Namespace"] as const,
};

export const prebuildKeys = {
  all: (tenantId: string) => [tenantId, "prebuilds"] as const,
  latest: (tenantId: string) => [tenantId, "prebuilds", "latest"] as const,
  list: (tenantId: string, repository: string) => [tenantId, "prebuilds", "repository", repository] as const,
  failure: (tenantId: string, prebuildId: string) => [tenantId, "prebuildFailures", prebuildId] as const,
};

export const useConnections = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: connectionKeys.list(tenantId), queryFn: () => api.listConnections() });
};

export const useGitHubActionsConnection = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: connectionKeys.gitHubActions(tenantId),
    queryFn: () => api.getGitHubActionsConnection(),
  });
};

export const useCircleCIConnection = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: connectionKeys.circleCI(tenantId), queryFn: () => api.getCircleCIConnection() });
};

export const useCircleCIProjects = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: connectionKeys.circleCIProjects(tenantId), queryFn: () => api.listCircleCIProjects() });
};

export const useNamespaceConnection = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: connectionKeys.namespace(tenantId), queryFn: () => api.getNamespaceConnection() });
};

export const usePrebuildFailure = (tenantId: string, prebuildId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: prebuildKeys.failure(tenantId, prebuildId),
    queryFn: () => api.getPrebuildFailure(prebuildId),
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useLatestPrebuilds = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: prebuildKeys.latest(tenantId), queryFn: () => api.listLatestPrebuilds() });
};

export const usePrebuilds = (tenantId: string, repository: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: prebuildKeys.list(tenantId, repository),
    queryFn: () => api.listPrebuilds(repository),
  });
};

export const memberKeys = {
  tenants: (tenantId: string) => [tenantId, "tenants"] as const,
  members: (tenantId: string) => [tenantId, "members"] as const,
  invitations: (tenantId: string) => [tenantId, "invitations"] as const,
  devices: (tenantId: string) => [tenantId, "devices"] as const,
};

export const useTenants = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: memberKeys.tenants(tenantId),
    queryFn: () => api.listTenants(),
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useDevices = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: memberKeys.devices(tenantId), queryFn: () => api.listDevices() });
};

export const useMembers = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: memberKeys.members(tenantId), queryFn: () => api.listMembers() });
};

export const useInvitations = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: memberKeys.invitations(tenantId), queryFn: () => api.listInvitations() });
};

export const metricKeys = {
  catalog: (tenantId: string, window: MetricWindow) => [tenantId, "metrics", "catalog", window] as const,
  series: (tenantId: string, metric: string, query: MetricSeriesQuery) =>
    [tenantId, "metrics", metric, "series", query] as const,
  turns: (tenantId: string, metric: string, bucketStart: string, bucket: MetricBucket, filter: readonly string[]) =>
    [tenantId, "metrics", metric, "turns", bucketStart, bucket, filter] as const,
  sessionCost: (tenantId: string, sessionId: string, window: MetricWindow) =>
    [tenantId, "metrics", COST_METRIC, "session", sessionId, window] as const,
};

export const useMetricCatalog = (tenantId: string, window: MetricWindow) => {
  const api = useTenantApi(tenantId);
  return useQuery({ queryKey: metricKeys.catalog(tenantId, window), queryFn: () => api.metricCatalog(window) });
};

export const useMetricSeries = (tenantId: string, metric: string | null, query: MetricSeriesQuery) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: metricKeys.series(tenantId, metric ?? "", query),
    queryFn: metric === null ? skipToken : () => api.queryMetric(metric, query),
  });
};

export const useMetricTurns = (
  tenantId: string,
  metric: string,
  bucketStart: string,
  bucket: MetricBucket,
  filter: readonly string[],
) => {
  const api = useTenantApi(tenantId);
  return useInfiniteQuery({
    queryKey: metricKeys.turns(tenantId, metric, bucketStart, bucket, filter),
    queryFn: ({ pageParam }) => api.metricTurns(metric, turnsQuery(bucketStart, bucket, filter, pageParam)),
    initialPageParam: "",
    getNextPageParam: (page) => (page.finished ? undefined : page.cursor),
  });
};

export const useSessionCostPoints = (tenantId: string, sessionId: string, window: MetricWindow, enabled: boolean) => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: metricKeys.sessionCost(tenantId, sessionId, window),
    queryFn: enabled
      ? async () => {
          const points: MetricTurnPoint[] = [];
          let cursor = "";
          for (;;) {
            const page = await api.metricTurns(COST_METRIC, { ...window, sessionId, ...(cursor !== "" && { cursor }) });
            points.push(...page.points);
            if (page.finished) return points;
            cursor = page.cursor;
          }
        }
      : skipToken,
  });
};
