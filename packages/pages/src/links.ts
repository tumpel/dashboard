export interface StageOrigins {
  dashboard: string;
  api: string;
}

export const SHARED_LINKS = {
  docs: "https://github.com/mvhenten/tumpel/tree/main/doc",
  github: "https://github.com/mvhenten/tumpel",
  report: "https://github.com/mvhenten/tumpel/issues/new",
} as const;

export const CLI_DOWNLOAD_PATH = "/v1/releases/cli/Amd64";

export interface Links extends StageOrigins {
  docs: string;
  cli: string;
  github: string;
  report: string;
}

export interface ControlPlaneRoutes {
  signOut: string;
  device: string;
  appSetup: string;
  createTenant: string;
  approveDevice: string;
  denyDevice: string;
  acceptInvitation: string;
}

export interface ServerLinks extends Links {
  routes: ControlPlaneRoutes;
}

export const linksFor = (origins: StageOrigins): Links => ({
  ...origins,
  ...SHARED_LINKS,
  cli: `${origins.api}${CLI_DOWNLOAD_PATH}`,
});

export const dashboardUrl = (links: Links, path: string, tenantId: string | null): string =>
  tenantId === null ? `${links.dashboard}${path}` : `${links.dashboard}/t/${encodeURIComponent(tenantId)}${path}`;

export const DASHBOARD_PATHS = {
  overview: "/overview",
  onboarding: "/setup/github?from=github",
  connections: "/connections",
  account: "/account",
  signIn: "/signin",
} as const;

export const TENANTLESS_DASHBOARD_PATHS = ["/overview", "/setup/github", "/connections", "/account"] as const;

export const FONT_FILES = {
  sans: "/fonts/inter-latin-wght-normal.woff2",
  mono: "/fonts/jetbrains-mono-latin-wght-normal.woff2",
} as const;

export const reportUrl = (links: Links, title: string, detail: string, path: string, at: Date): string => {
  const body = [`What failed: ${title}`, `Detail: ${detail}`, `Page: ${path}`, `Time: ${at.toISOString()}`].join("\n");
  return `${links.report}?${new URLSearchParams({ title: `Page: ${title}`, body }).toString()}`;
};
