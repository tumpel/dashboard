import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type CredentialProblem, checkCredential, credentialProblem } from "@tumpel/api/credentials";
import { ClaudeSetupMemberSchema } from "@tumpel/schemas";
import { useEffect, useState } from "react";
import type { GitHubInstallation, HarnessCatalogEntry, Host, OAuthGrant, Persona, SecretSet, Whoami } from "./api/port";
import { useTenantApi } from "./context";
import { activeHost } from "./fleet";
import { keys, useHarnessCatalog, useHosts, useOAuthGrants, usePersonas, useSecretSets, useWhoami } from "./queries";

export const SETUP_STEPS = ["tenant", "github", "host", "claude", "persona", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export const CHECKED_STEPS = ["tenant", "github", "host", "claude", "persona"] as const;
export type CheckedStep = (typeof CHECKED_STEPS)[number];

export const STEP_LABELS: Record<SetupStep, string> = {
  tenant: "Tenant",
  github: "GitHub",
  host: "Host",
  claude: "claude.ai",
  persona: "Persona",
  done: "Done",
};

export const STEP_TITLES: Record<SetupStep, string> = {
  tenant: "Name your tenant",
  github: "Connect GitHub",
  host: "Add a host",
  claude: "Connect claude.ai",
  persona: "Your first persona",
  done: "Done",
};

export const CLAUDE_ORIGIN = "https://claude.ai";
export const CLAUDE_TOKEN = ClaudeSetupMemberSchema.enum.CLAUDE_CODE_OAUTH_TOKEN;
export const GITHUB_TOKEN = "GITHUB_TOKEN";
export const DEFAULT_NAME = "Default";
export const STILL_LOADING_MS = 10_000;

export type StepState = { kind: "Loading" } | { kind: "Failed"; error: unknown; retry: () => void } | StepRead;
export type StepRead = { kind: "Read"; done: boolean };

export const isDone = (state: StepState): boolean => state.kind === "Read" && state.done;

export const isOpen = (state: StepState): boolean => state.kind === "Read" && !state.done;

export const useStillLoading = (pending: boolean): boolean => {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(false);
    if (!pending) return;
    const timer = window.setTimeout(() => setStill(true), STILL_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);
  return still;
};

export const claudeGrant = (grants: readonly OAuthGrant[]): OAuthGrant | undefined =>
  grants.find((grant) => grant.redirectOrigin === CLAUDE_ORIGIN);

export type GitHubStepRead = { connected: boolean; logins: string[] };

const gitHubStepRead = (installations: GitHubInstallation[]): GitHubStepRead => {
  const logins = installations.filter(({ status }) => status === "Active").map(({ accountLogin }) => accountLogin);
  return { connected: logins.length > 0, logins };
};

export const useGitHubStepRead = (tenantId: string): UseQueryResult<GitHubStepRead> => {
  const api = useTenantApi(tenantId);
  return useQuery({
    queryKey: keys.githubInstallations(tenantId),
    queryFn: () => api.listGitHubInstallations(),
    select: gitHubStepRead,
  });
};

export type PersonaReadiness =
  | { kind: "Ready"; persona: Persona; secretSet: SecretSet; expiresAt: string | null }
  | { kind: "Refused"; persona: Persona; secretSet: SecretSet; problem: CredentialProblem }
  | { kind: "Missing" };

export const readyPersona = (
  personas: readonly Persona[],
  sets: readonly SecretSet[],
  catalog: readonly HarnessCatalogEntry[],
  now: number,
): PersonaReadiness => {
  const byId = new Map(sets.map((set) => [set.secretSetId, set]));
  let refused: PersonaReadiness = { kind: "Missing" };
  for (const persona of personas) {
    const secretSet = byId.get(persona.secretSetId);
    const entry = catalog.find((each) => each.harness === persona.harness);
    if (secretSet === undefined || entry === undefined) continue;
    const checked = checkCredential(entry, secretSet.keys, now);
    if (checked.kind === "Usable") {
      const { credential } = checked;
      return {
        kind: "Ready",
        persona,
        secretSet,
        expiresAt: credential.kind === "SubscriptionToken" ? credential.expiresAt : null,
      };
    }
    if (refused.kind === "Missing") {
      const problem = credentialProblem(checked, `secret set ${secretSet.name}`, persona.harness, "start a session");
      refused = { kind: "Refused", persona, secretSet, problem };
    }
  }
  return refused;
};

const fromQuery = <T>(query: UseQueryResult<T>, done: (data: T) => boolean): StepState => {
  if (query.isPending) return { kind: "Loading" };
  if (query.isError) return { kind: "Failed", error: query.error, retry: () => void query.refetch() };
  return { kind: "Read", done: done(query.data) };
};

const combined = (queries: UseQueryResult<unknown>[], done: () => boolean): StepState => {
  const failed = queries.find((query) => query.isError);
  if (failed !== undefined) {
    return {
      kind: "Failed",
      error: failed.error,
      retry: () => {
        for (const query of queries) if (query.isError) void query.refetch();
      },
    };
  }
  if (queries.some((query) => query.isPending)) return { kind: "Loading" };
  return { kind: "Read", done: done() };
};

export interface SetupReads {
  whoami: UseQueryResult<Whoami>;
  github: UseQueryResult<GitHubStepRead>;
  hosts: UseQueryResult<Host[]>;
  grants: UseQueryResult<OAuthGrant[]>;
  personas: UseQueryResult<Persona[]>;
  sets: UseQueryResult<SecretSet[]>;
  catalog: UseQueryResult<HarnessCatalogEntry[]>;
  states: Record<CheckedStep, StepState>;
}

export const useSetupReads = (tenantId: string): SetupReads => {
  const whoami = useWhoami(tenantId);
  const github = useGitHubStepRead(tenantId);
  const hosts = useHosts(tenantId);
  const grants = useOAuthGrants(tenantId);
  const personas = usePersonas(tenantId);
  const sets = useSecretSets(tenantId);
  const catalog = useHarnessCatalog(tenantId);
  const now = Date.now();
  return {
    whoami,
    github,
    hosts,
    grants,
    personas,
    sets,
    catalog,
    states: {
      tenant: fromQuery(whoami, () => true),
      github: fromQuery(github, (data) => data.connected),
      host: fromQuery(hosts, (data) => activeHost(data) !== undefined),
      claude: fromQuery(grants, (data) => claudeGrant(data) !== undefined),
      persona: combined(
        [personas, sets, catalog],
        () => readyPersona(personas.data ?? [], sets.data ?? [], catalog.data ?? [], now).kind === "Ready",
      ),
    },
  };
};

export const firstOpenStep = (states: Record<CheckedStep, StepState>): SetupStep =>
  CHECKED_STEPS.find((step) => !isDone(states[step])) ?? "done";

export const allDone = (states: Record<CheckedStep, StepState>): boolean =>
  CHECKED_STEPS.every((step) => isDone(states[step]));

export const openSteps = (states: Record<CheckedStep, StepState>): CheckedStep[] =>
  CHECKED_STEPS.filter((step) => isOpen(states[step]));
