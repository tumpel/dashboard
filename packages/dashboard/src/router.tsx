import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  type RouterHistory,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { TENANTLESS_DASHBOARD_PATHS } from "@tumpel/pages";
import {
  BuildProviderSchema,
  HarnessSchema,
  HostStateSchema,
  PrebuildStateSchema,
  SessionStateSchema,
} from "@tumpel/schemas";
import { useLayoutEffect } from "react";
import { z } from "zod";
import { EmptyState } from "./components/empty-state";
import { Button } from "./components/ui/button";
import { useDashboard } from "./context";
import { gitHubReturnSearch } from "./github-return";
import { MetricsSearchSchema } from "./metrics-search";
import type { WizardSearch } from "./prebuild-wizard";
import { AccountScreen } from "./screens/account";
import { ConnectionsScreen } from "./screens/connections";
import { ConnectorsScreen } from "./screens/connectors";
import {
  BuildStepScreen,
  MergeStepScreen,
  PreviewStepScreen,
  RepositoryStepScreen,
  TemplateStepScreen,
} from "./screens/create-prebuild";
import { HarnessesScreen } from "./screens/harnesses";
import { HostDetailScreen } from "./screens/host-detail";
import { HostsListScreen } from "./screens/hosts-list";
import { LandingScreen } from "./screens/landing";
import { MembersScreen } from "./screens/members";
import { MetricsExploreScreen } from "./screens/metrics-explore";
import { MetricsHostScreen, MetricsHostsScreen } from "./screens/metrics-hosts";
import { MetricsOverviewScreen } from "./screens/metrics-overview";
import { MetricsStartupScreen } from "./screens/metrics-startup";
import { OverviewScreen } from "./screens/overview";
import { NewPersonaScreen, PersonaScreen } from "./screens/persona-form";
import { PersonasListScreen } from "./screens/personas-list";
import { PrebuildsScreen } from "./screens/prebuilds";
import { SecretSetDetailScreen } from "./screens/secret-set-detail";
import { EditSecretSetScreen } from "./screens/secret-set-form";
import { AddSecretScreen, NewSecretSetScreen, SECRET_CHOICES, type SecretChoice } from "./screens/secret-set-wizard";
import { SecretSetsListScreen } from "./screens/secret-sets-list";
import { SESSION_TABS, SessionDetailScreen, SessionLatestTurn } from "./screens/session-detail";
import { SessionsListScreen } from "./screens/sessions-list";
import { SetupIndexScreen, SetupStepScreen } from "./screens/setup/wizard";
import { CallbackScreen, SignInScreen } from "./screens/signin";
import { START_SOURCES, StartSessionScreen } from "./screens/start-session";
import { TenantHome } from "./screens/tenant-home";
import { TriggerScreen } from "./screens/trigger-detail";
import { EditTriggerScreen, NewTriggerScreen } from "./screens/trigger-form";
import { TriggersListScreen } from "./screens/triggers-list";
import { AppShell } from "./shell/app-shell";

const parseSearch = (search: string): Record<string, string[]> => {
  const parsed: Record<string, string[]> = {};
  for (const [key, value] of new URLSearchParams(search)) parsed[key] = [...(parsed[key] ?? []), value];
  return parsed;
};

const stringifySearch = (search: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    for (const item of [value].flat()) if (typeof item === "string") params.append(key, item);
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

const NotFound = () => (
  <div className="p-6">
    <EmptyState
      title="No such page"
      detail="The dashboard has no page at this address."
      action={
        <Button asChild>
          <a href="/">Open the dashboard</a>
        </Button>
      }
    />
  </div>
);

const Home = () => {
  const { ports } = useDashboard();
  const first = ports.auth.signedInTenants()[0];
  if (first === undefined) return <LandingScreen />;
  return <Navigate to="/t/$tenantId" params={{ tenantId: first.tenantId }} replace />;
};

const Tenantless = ({ path }: { path: string }) => {
  const { ports } = useDashboard();
  const router = useRouter();
  const { searchStr } = useLocation();
  const tenantId = ports.auth.signedInTenants()[0]?.tenantId;
  useLayoutEffect(() => {
    if (tenantId !== undefined) router.history.replace(`/t/${encodeURIComponent(tenantId)}${path}${searchStr}`);
  }, [router, tenantId, path, searchStr]);
  if (tenantId === undefined) return <SignInScreen returnPath={`${path}${searchStr}`} />;
  return null;
};

const tenantlessRoutes = TENANTLESS_DASHBOARD_PATHS.map((path) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => <Tenantless path={path} /> }),
);

const rootRoute = createRootRoute({ component: Outlet, notFoundComponent: NotFound });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home });

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin",
  component: () => <SignInScreen returnPath="/" />,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: CallbackScreen,
});

const tenantRoute = createRoute({ getParentRoute: () => rootRoute, path: "/t/$tenantId", component: AppShell });

const tenantHomeRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/",
  component: () => {
    const { tenantId } = tenantRoute.useParams();
    return <TenantHome tenantId={tenantId} />;
  },
});

const overviewRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/overview",
  component: OverviewScreen,
});

const metricsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/metrics",
  validateSearch: MetricsSearchSchema,
  component: () => (
    <MetricsOverviewScreen tenantId={tenantRoute.useParams().tenantId} search={metricsRoute.useSearch()} />
  ),
});

const metricsStartupRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/metrics/startup",
  validateSearch: MetricsSearchSchema,
  component: () => (
    <MetricsStartupScreen tenantId={tenantRoute.useParams().tenantId} search={metricsStartupRoute.useSearch()} />
  ),
});

const metricsHostsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/metrics/hosts",
  validateSearch: MetricsSearchSchema,
  component: () => (
    <MetricsHostsScreen tenantId={tenantRoute.useParams().tenantId} search={metricsHostsRoute.useSearch()} />
  ),
});

const metricsHostRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/metrics/hosts/$hostId",
  validateSearch: MetricsSearchSchema,
  component: () => (
    <MetricsHostScreen
      tenantId={tenantRoute.useParams().tenantId}
      hostId={metricsHostRoute.useParams().hostId}
      search={metricsHostRoute.useSearch()}
    />
  ),
});

const metricsExploreRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/metrics/explore",
  validateSearch: MetricsSearchSchema,
  component: () => (
    <MetricsExploreScreen tenantId={tenantRoute.useParams().tenantId} search={metricsExploreRoute.useSearch()} />
  ),
});

const HostsSearchSchema = z.object({ state: z.array(HostStateSchema).catch([]) });

const hostsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/hosts",
  validateSearch: HostsSearchSchema,
  component: HostsListScreen,
});

const hostRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/hosts/$hostId",
  component: HostDetailScreen,
});

const SessionsSearchSchema = z.object({
  state: z.array(SessionStateSchema).catch([]),
  hostId: z.array(z.string()).catch([]),
  trigger: z.array(z.string()).catch([]),
});

const sessionsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/sessions",
  validateSearch: SessionsSearchSchema,
  component: SessionsListScreen,
});

const StartSearchSchema = z.object({
  source: z.array(z.enum(START_SOURCES)).catch([]),
  persona: z.array(z.string()).catch([]),
  repo: z.array(z.string()).catch([]),
  issue: z.array(z.string()).catch([]),
  model: z.array(z.string()).catch([]),
  prompt: z.array(z.string()).catch([]),
});

const startSessionRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/sessions/new",
  validateSearch: StartSearchSchema,
  component: StartSessionScreen,
});

const sessionRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/sessions/$sessionId",
  component: SessionLatestTurn,
});

const TurnSearchSchema = z.object({
  compact: z.array(z.enum(["0", "1"])).catch([]),
  tab: z.array(z.enum(SESSION_TABS)).catch([]),
});

const turnRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/sessions/$sessionId/turns/$turnId",
  validateSearch: TurnSearchSchema,
  component: SessionDetailScreen,
});

const harnessesRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/harnesses",
  validateSearch: z.object({ harness: z.array(HarnessSchema).catch([]) }),
  component: HarnessesScreen,
});

const personasRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/personas",
  component: PersonasListScreen,
});

const newPersonaRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/personas/new",
  validateSearch: z.object({ harness: z.array(HarnessSchema).catch([]), file: z.array(z.string()).catch([]) }),
  component: NewPersonaScreen,
});

const personaRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/personas/$personaId",
  validateSearch: z.object({ file: z.array(z.string()).catch([]) }),
  component: PersonaScreen,
});

const triggersRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/triggers",
  component: TriggersListScreen,
});

const newTriggerRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/triggers/new",
  component: NewTriggerScreen,
});

const triggerRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/triggers/$triggerId",
  component: TriggerScreen,
});

const editTriggerRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/triggers/$triggerId/edit",
  component: EditTriggerScreen,
});

const secretSetsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/secrets",
  component: SecretSetsListScreen,
});

const newSecretSetRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/secrets/new",
  component: NewSecretSetScreen,
});

const secretSetRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/secrets/$secretSetId",
  validateSearch: (search: Record<string, unknown>): { openRouterAuthorizationId?: string } => {
    const openRouterAuthorizationId = single(z.string().min(1), search.openRouterAuthorizationId);
    return openRouterAuthorizationId === null ? {} : { openRouterAuthorizationId };
  },
  component: SecretSetDetailScreen,
});

const addSecretRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/secrets/$secretSetId/add",
  validateSearch: (search: Record<string, unknown>): { secret?: SecretChoice } => {
    const secret = single(z.enum(SECRET_CHOICES), search.secret);
    return secret === null ? {} : { secret };
  },
  component: AddSecretScreen,
});

const editSecretSetRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/secrets/$secretSetId/edit",
  validateSearch: z.object({ replace: z.array(z.string()).catch([]) }),
  component: EditSecretSetScreen,
});

const connectionsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/connections",
  validateSearch: z.object({
    from: z
      .array(z.enum(["github"]))
      .optional()
      .catch(undefined),
    ...gitHubReturnSearch,
  }),
  component: ConnectionsScreen,
});

const connectorsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/connectors",
  component: ConnectorsScreen,
});

const single = <T,>(schema: z.ZodType<T>, value: unknown): T | null => {
  const parsed = schema.safeParse([value].flat()[0]);
  return parsed.success ? parsed.data : null;
};

const PrebuildStatesSchema = z.array(PrebuildStateSchema).catch([]);

const prebuildsSearch = (search: Record<string, unknown>) => ({
  state: PrebuildStatesSchema.parse(search.state),
  provider: single(BuildProviderSchema, search.provider),
  repo: single(z.string().min(1), search.repo),
});

const prebuildsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds",
  validateSearch: prebuildsSearch,
  component: PrebuildsScreen,
});

const wizardSearch = (search: Record<string, unknown>): WizardSearch => ({
  repo: single(z.string().min(1), search.repo),
  persona: single(z.string().min(1), search.persona),
  template: single(z.string().min(1), search.template),
  pr: single(z.string().regex(/^[1-9][0-9]*$/), search.pr),
  prebuild: single(z.string().min(1), search.prebuild),
});

const newPrebuildRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds/new",
  validateSearch: wizardSearch,
  component: RepositoryStepScreen,
});

const newPrebuildTemplateRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds/new/template",
  validateSearch: wizardSearch,
  component: TemplateStepScreen,
});

const newPrebuildPreviewRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds/new/preview",
  validateSearch: wizardSearch,
  component: PreviewStepScreen,
});

const newPrebuildMergeRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds/new/merge",
  validateSearch: wizardSearch,
  component: MergeStepScreen,
});

const newPrebuildBuildRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/prebuilds/new/build",
  validateSearch: wizardSearch,
  component: BuildStepScreen,
});

const membersRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/members",
  component: MembersScreen,
});

const accountRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/account",
  component: AccountScreen,
});

const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/t/$tenantId/setup", component: Outlet });

const setupIndexRoute = createRoute({ getParentRoute: () => setupRoute, path: "/", component: SetupIndexScreen });

const setupStepRoute = createRoute({
  getParentRoute: () => setupRoute,
  path: "/$step",
  validateSearch: z.object({ from: z.array(z.enum(["github"])).catch([]), ...gitHubReturnSearch }),
  component: SetupStepScreen,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  signInRoute,
  callbackRoute,
  ...tenantlessRoutes,
  setupRoute.addChildren([setupIndexRoute, setupStepRoute]),
  tenantRoute.addChildren([
    tenantHomeRoute,
    overviewRoute,
    metricsRoute,
    metricsStartupRoute,
    metricsHostsRoute,
    metricsHostRoute,
    metricsExploreRoute,
    hostsRoute,
    hostRoute,
    sessionsRoute,
    startSessionRoute,
    sessionRoute,
    turnRoute,
    harnessesRoute,
    personasRoute,
    newPersonaRoute,
    personaRoute,
    triggersRoute,
    newTriggerRoute,
    triggerRoute,
    editTriggerRoute,
    secretSetsRoute,
    newSecretSetRoute,
    secretSetRoute,
    addSecretRoute,
    editSecretSetRoute,
    connectionsRoute,
    connectorsRoute,
    prebuildsRoute,
    newPrebuildRoute,
    newPrebuildTemplateRoute,
    newPrebuildPreviewRoute,
    newPrebuildMergeRoute,
    newPrebuildBuildRoute,
    membersRoute,
    accountRoute,
  ]),
]);

export const createDashboardRouter = (history?: RouterHistory) =>
  createRouter({ routeTree, history, parseSearch, stringifySearch, defaultPreload: false });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createDashboardRouter>;
  }
}
