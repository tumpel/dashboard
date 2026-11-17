import { DASHBOARD_PATHS, dashboardUrl, type Links, type ServerLinks } from "./links.ts";
import { type Html, html, mainHtml, type NextStep, NO_HTML, type Page, type PageContext } from "./shell.ts";

export interface TenantChoice {
  tenantId: string;
  name: string;
}

const step = (kind: NextStep["kind"], label: string, href: string, external = false): NextStep => ({
  kind,
  label,
  href,
  external,
  hidden: false,
});

const primary = (label: string, href: string, external = false): NextStep => step("Primary", label, href, external);
const secondary = (label: string, href: string, external = false): NextStep => step("Secondary", label, href, external);
const link = (label: string, href: string, external = false): NextStep => step("Link", label, href, external);
const report = (hidden = false): NextStep => ({ ...step("Report", "Report an issue", ""), hidden });

const dashboard = (links: Links, tenantId: string | null = null): string =>
  dashboardUrl(links, DASHBOARD_PATHS.overview, tenantId);
const onboarding = (links: Links, tenantId: string | null = null): string =>
  dashboardUrl(links, DASHBOARD_PATHS.onboarding, tenantId);
const connections = (links: Links, tenantId: string | null = null): string =>
  dashboardUrl(links, DASHBOARD_PATHS.connections, tenantId);
const account = (links: Links, tenantId: string | null = null): string =>
  dashboardUrl(links, DASHBOARD_PATHS.account, tenantId);

const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

const p = (text: string | Html): Html => html`<p>${text}</p>`;

const DROPPED = "The control plane did not answer. Check your connection, then try again.";

const ICON_ALERT =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none;color:var(--destructive)"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7" stroke="var(--card)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.4" fill="var(--card)"/></svg>';
const ICON_RESULT =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none;color:var(--success)"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--card)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const alertBlock = (refusal: string, hidden: boolean): Html =>
  html`<div class="tp-alert" id="tp-alert" role="alert"${hidden ? html` hidden` : NO_HTML}>${{ html: ICON_ALERT }}<span>${refusal}</span></div>`;

const hiddenAlert = (): Html => alertBlock("", true);

const resultBlock = (text: string): Html =>
  html`<div class="tp-result" role="status" tabindex="-1" id="tp-result">${{ html: ICON_RESULT }}<span>${text}</span></div>`;

const POST_SCRIPT = `const DROPPED = ${scriptJson(DROPPED)};
const refusalOf = async (response) => {
  const problem = await response.json().catch(() => null);
  if (problem && problem.detail && problem.fix) return problem.detail + ". Fix: " + problem.fix + ".";
  return "The control plane answered " + response.status + " without a Problem. Try again, then report it with the link below.";
};
const post = (path, body) =>
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
    .then(async (response) => (response.ok ? { ok: true, answer: response.status === 204 ? {} : await response.json() } : { ok: false, text: await refusalOf(response) }), () => ({ ok: false, text: DROPPED }));
const refuse = (text, button) => {
  const alert = document.getElementById("tp-alert");
  alert.querySelector("span").textContent = text;
  alert.hidden = false;
  const reportLink = document.getElementById("tp-report");
  if (reportLink) reportLink.hidden = false;
  if (button) button.focus();
};`;

const errorPage = (title: string, email: string | null, detail: string, fix: string, next: NextStep[]): Page => ({
  title,
  email,
  body: p(detail),
  next,
  mark: "Error",
  fix,
  detail,
  script: null,
});

export const landingPage = (links: Links): Page => ({
  title: "Run coding agents on your own machines",
  email: null,
  body: html`${p("Tumpel runs Claude Code, Codex, OpenCode and Pi.dev in short-lived boxes on hosts you own. You start and steer each session from claude.ai, from the dashboard or from the tumpel CLI.")}<ol class="tp-steps"><li><strong>Connect GitHub</strong><span>Each turn gets a repository token of its own.</span></li><li><strong>Add a host</strong><span>One command installs the supervisor on a Linux machine.</span></li><li><strong>Connect claude.ai</strong><span>Add Tumpel as a custom connector and start sessions there.</span></li></ol>`,
  next: [
    primary("Sign in", `${links.dashboard}${DASHBOARD_PATHS.signIn}`),
    secondary("Read the docs", links.docs, true),
  ],
  mark: null,
  fix: null,
  detail: "Landing page",
  script: null,
});

export const signUpPage = (links: ServerLinks, email: string): Page => ({
  title: "Create your tenant",
  email,
  body: html`${p(`Signed in as ${email}, which belongs to no tenant yet. A tenant holds your hosts, sessions, personas and connections.`)}<form class="tp-form" id="signup"><label for="name">Tenant name</label><input id="name" name="name" maxlength="100" autocomplete="organization" placeholder="Tenant name" required autofocus><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit">Create tenant</button></div></form>${hiddenAlert()}`,
  next: [link("Sign in as another email", links.routes.signOut), report(true)],
  mark: null,
  fix: null,
  detail: "Creating a tenant failed",
  script: `${POST_SCRIPT}
const form = document.getElementById("signup");
const button = form.querySelector("button");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "Creating tenant...";
  const outcome = await post(${scriptJson(links.routes.createTenant)}, { name: form.elements.name.value.trim() });
  if (outcome.ok) {
    location.reload();
    return;
  }
  button.disabled = false;
  button.textContent = "Create tenant";
  refuse(outcome.text, button);
});`,
});

export const enterCodePage = (links: ServerLinks, email: string): Page => ({
  title: "Sign in a device",
  email,
  body: html`${p("Enter the code your terminal shows.")}<form class="tp-form" method="get" action="${links.routes.device}"><label for="code">Code</label><input class="tp-mono" id="code" name="code" placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters" required autofocus><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit">Continue</button></div></form>`,
  next: [link("Open dashboard", dashboard(links))],
  mark: null,
  fix: null,
  detail: "Sign in a device",
  script: null,
});

const tenantPhrase = (tenants: TenantChoice[]): string => {
  const [only, ...others] = tenants;
  return only !== undefined && others.length === 0 ? `of ${only.name}` : "in the tenant you choose below";
};

const tenantField = (tenants: TenantChoice[], name: string): Html => {
  const [only, ...others] = tenants;
  if (only !== undefined && others.length === 0) {
    return html`<input type="hidden" name="${name}" value="${only.tenantId}">`;
  }
  const options = tenants.map((tenant) => html`<option value="${tenant.tenantId}">${tenant.name}</option>`);
  return html`<label for="tenant-field">Tenant</label><select id="tenant-field" name="${name}" required autofocus>${options}</select>`;
};

export const deviceApprovedPage = (links: Links, email: string, deviceName: string, tenant: TenantChoice): Page => ({
  title: "Device signed in",
  email,
  body: resultBlock(`Approved ${deviceName} for ${tenant.name}. Return to your terminal; it signs in by itself.`),
  next: [
    primary("Open dashboard", dashboard(links, tenant.tenantId)),
    link("Devices in your account", account(links, tenant.tenantId)),
  ],
  mark: "Done",
  fix: null,
  detail: "Device signed in",
  script: null,
});

export const deviceDeniedPage = (links: Links, email: string): Page => ({
  title: "Device denied",
  email,
  body: p("The device gets no access. To sign it in after all, run tumpel login again and enter the new code."),
  next: [secondary("Open dashboard", dashboard(links))],
  mark: null,
  fix: null,
  detail: "Device denied",
  script: null,
});

export interface DeviceRequest {
  email: string;
  tenants: TenantChoice[];
  userCode: string;
  deviceName: string;
}

export const confirmPage = (links: ServerLinks, request: DeviceRequest, context: PageContext): Page => {
  const { email, tenants, userCode, deviceName } = request;
  const approved = Object.fromEntries(
    tenants.map((tenant) => [
      tenant.tenantId,
      mainHtml(deviceApprovedPage(links, email, deviceName, tenant), context).html,
    ]),
  );
  const denied = mainHtml(deviceDeniedPage(links, email), context).html;
  return {
    title: "Sign in a device",
    email,
    body: html`${p(`The device ${deviceName} asks to use Tumpel as ${email} ${tenantPhrase(tenants)}.`)}${p("Check that your terminal shows this code:")}<p class="tp-code">${userCode}</p><form class="tp-form" id="decide">${tenantField(tenants, "tenantId")}<div class="tp-actions"><button class="tp-button tp-button-primary" type="submit" value="approve"${tenants.length === 1 ? html` autofocus` : NO_HTML}>Approve</button><button class="tp-button" type="submit" value="deny">Deny</button></div></form>${hiddenAlert()}`,
    next: [],
    mark: null,
    fix: null,
    detail: `Deciding the device code ${userCode} failed`,
    script: `${POST_SCRIPT}
const DECISIONS = ${scriptJson({ approve: links.routes.approveDevice, deny: links.routes.denyDevice })};
const APPROVED = ${scriptJson(approved)};
const DENIED = ${scriptJson(denied)};
const show = (main, title) => {
  document.getElementById("tp-main").innerHTML = main;
  document.title = title + " · Tumpel";
  const result = document.getElementById("tp-result");
  (result || document.querySelector("h1")).focus();
};
document.getElementById("decide").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const action = button.value;
  const tenantId = new FormData(event.target).get("tenantId");
  const decision = { userCode: ${scriptJson(userCode)} };
  const outcome = await post(DECISIONS[action], action === "approve" ? { ...decision, tenantId } : decision);
  if (!outcome.ok) {
    refuse(outcome.text, button);
    return;
  }
  if (action === "approve") show(APPROVED[tenantId], "Device signed in");
  else show(DENIED, "Device denied");
});`,
  };
};

export const codeNotFoundPage = (links: ServerLinks, email: string): Page =>
  errorPage(
    "Code not found",
    email,
    "The code is wrong, expired or already decided.",
    "Run tumpel login again and enter the code it prints.",
    [primary("Enter another code", links.routes.device), secondary("Open dashboard", dashboard(links)), report()],
  );

export interface ConsentRequest {
  email: string;
  tenants: TenantChoice[];
  clientName: string;
  callbackOrigin: string;
  requestId: string;
  csrf: string;
}

export interface ConsentClient {
  clientName: string;
  callbackOrigin: string;
  returnUrl: string | null;
}

export const consentPage = (links: Links, request: ConsentRequest): Page => {
  const { email, tenants, clientName, callbackOrigin, requestId, csrf } = request;
  const single = tenants.length === 1;
  return {
    title: `Connect ${clientName}`,
    email,
    body: html`${p(`${clientName} at ${callbackOrigin} asks to use Tumpel as ${email} ${tenantPhrase(tenants)}.`)}${single ? p(`Connect sends you back to ${clientName} with access to this tenant. Revoke it later under Account in the dashboard.`) : NO_HTML}<form class="tp-form" id="consent" method="post">${tenantField(tenants, "tenant")}<input type="hidden" name="request" value="${requestId}"><input type="hidden" name="csrf" value="${csrf}"><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit" name="action" value="approve"${single ? html` autofocus` : NO_HTML}>Connect</button><button class="tp-button" type="submit" name="action" value="deny">Cancel</button></div></form>`,
    next: [link("Open dashboard", dashboard(links))],
    mark: null,
    fix: null,
    detail: `Connect ${clientName}`,
    script: `const form = document.getElementById("consent");
let submitted = false;
form.addEventListener("submit", (event) => {
  if (submitted) event.preventDefault();
  submitted = true;
});`,
  };
};

const consentNext = (links: Links, client: ConsentClient | null): NextStep[] =>
  [
    client?.returnUrl == null ? null : primary(`Return to ${client.clientName}`, client.returnUrl, true),
    secondary("Open dashboard", dashboard(links)),
    report(),
  ].filter((each): each is NextStep => each !== null);

export const nothingToConnectPage = (links: Links, email: string, client: ConsentClient | null): Page =>
  errorPage(
    "Nothing to connect",
    email,
    "This sign-in expired or already finished.",
    client === null
      ? "Start the connection again from the app you came from."
      : `Start again from ${client.clientName}.`,
    consentNext(links, client),
  );

export const alreadyApprovedPage = (links: Links, email: string, client: ConsentClient): Page => ({
  title: "Already approved",
  email,
  body: html`${p(`This sign-in was already approved; return to ${client.clientName}.`)}${p(`If ${client.clientName} does not show Tumpel as connected, start again from ${client.clientName}.`)}`,
  next: consentNext(links, client),
  mark: "Done",
  fix: null,
  detail: `Connect ${client.clientName}`,
  script: null,
});

export const noTenantPage = (links: Links, email: string): Page =>
  errorPage(
    "No tenant",
    email,
    `${email} belongs to no tenant yet, so there is nothing to connect.`,
    "Open the dashboard, create a tenant, then connect again from the client.",
    [primary("Open dashboard", dashboard(links)), report()],
  );

export const unknownClientPage = (links: Links): Page =>
  errorPage(
    "Unknown client",
    null,
    "The client asking for access has not registered with this Tumpel.",
    "Remove the connector and add it again.",
    consentNext(links, null),
  );

export type ConsentRefusal = "CrossSite" | "NoAction" | "NotYourTenant";

const CONSENT_REFUSALS: Record<ConsentRefusal, { title: string; detail: string; fix: string }> = {
  CrossSite: {
    title: "Request refused",
    detail: "The form did not come from this page.",
    fix: "Go back to the client and connect again.",
  },
  NoAction: {
    title: "Bad request",
    detail: "The form named neither Connect nor Cancel.",
    fix: "Choose Connect or Cancel.",
  },
  NotYourTenant: {
    title: "Not your tenant",
    detail: "The form named a tenant outside your memberships.",
    fix: "Choose one of the tenants the page lists.",
  },
};

export const consentRefusedPage = (
  links: Links,
  email: string,
  refusal: ConsentRefusal,
  client: ConsentClient | null,
): Page => {
  const { title, detail, fix } = CONSENT_REFUSALS[refusal];
  return errorPage(title, email, detail, fix, consentNext(links, client));
};

export interface Invitation {
  email: string;
  tenantName: string;
  role: string;
  token: string;
  next: string;
}

export const acceptPage = (links: ServerLinks, invitation: Invitation): Page => {
  const { email, tenantName, role, token, next } = invitation;
  return {
    title: `Join ${tenantName}`,
    email,
    body: html`${p(`Signed in as ${email}, invited to join ${tenantName} as ${role}.`)}<form class="tp-form" id="accept"><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit" autofocus>Join ${tenantName}</button></div></form>${hiddenAlert()}`,
    next: [link("Sign in as another email", links.routes.signOut), report(true)],
    mark: null,
    fix: null,
    detail: `Joining ${tenantName} failed`,
    script: `${POST_SCRIPT}
const form = document.getElementById("accept");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const outcome = await post(${scriptJson(links.routes.acceptInvitation)}, { token: ${scriptJson(token)} });
  if (outcome.ok) {
    location.assign(${scriptJson(next)});
    return;
  }
  refuse(outcome.text, form.querySelector("button"));
});`,
  };
};

export const invitationExpiredPage = (links: Links, email: string): Page =>
  errorPage("Invitation expired", email, "This invitation expired.", "Ask an Owner of the tenant for a new one.", [
    primary("Open dashboard", dashboard(links)),
    report(),
  ]);

export const invitationOtherEmailPage = (links: ServerLinks, email: string, invitee: string): Page =>
  errorPage(
    "Invitation for another email",
    email,
    `This invitation is for ${invitee}, and you are signed in as ${email}.`,
    `Sign in to Cloudflare Access as ${invitee}.`,
    [
      primary("Sign in as another email", links.routes.signOut),
      secondary("Open dashboard", dashboard(links)),
      report(),
    ],
  );

export const invitationNotFoundPage = (links: Links, email: string): Page =>
  errorPage(
    "No such invitation",
    email,
    "This invitation is unknown, revoked or already accepted.",
    "Ask an Owner of the tenant for a new one.",
    [primary("Open dashboard", dashboard(links)), report()],
  );

const APP_INTRO =
  "This stage has no GitHub App yet. Creating it is a one-time step. GitHub shows the App this page describes and sends you back here once it exists.";
const APP_ACCESS =
  "It asks for read and write access to contents, pull requests, issues, checks, statuses, workflows and discussions, and read access to actions and metadata. It asks for no administration, members, organization or secrets access.";
const ORG_LABEL = "GitHub organization (leave empty for your own account)";
const CREATE_LABEL = "Create the GitHub App on GitHub";

const appSetupNext = (links: Links): NextStep[] => [
  secondary("GitHub connections", connections(links)),
  link("Back to onboarding", onboarding(links)),
];

export interface AppManifestForm {
  manifest: unknown;
  action: string;
  organization: string;
}

export const appSetupPage = (links: Links, email: string, form: AppManifestForm): Page => ({
  title: "Create the GitHub App",
  email,
  body: html`${p(APP_INTRO)}${p(APP_ACCESS)}<form class="tp-form" id="app-manifest" method="post" action="${form.action}"><label for="organization">${ORG_LABEL}</label><input id="organization" name="organization" value="${form.organization}" placeholder="example-org" autocomplete="off"><input type="hidden" name="manifest" value="${JSON.stringify(form.manifest)}"><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit">${CREATE_LABEL}<span aria-hidden="true"> ↗</span></button></div></form>`,
  next: appSetupNext(links),
  mark: null,
  fix: null,
  detail: "Create the GitHub App",
  script: `const form = document.getElementById("app-manifest");
form.addEventListener("submit", (event) => {
  const typed = form.elements.organization.value.trim();
  if (typed === ${scriptJson(form.organization)}) return;
  event.preventDefault();
  location.assign(typed === "" ? location.pathname : location.pathname + "?" + new URLSearchParams({ organization: typed }));
});`,
});

export const appBadOrganizationPage = (links: ServerLinks, email: string, organization: string): Page => ({
  title: "Create the GitHub App",
  email,
  body: html`${p(APP_INTRO)}<form class="tp-form" method="get" action="${links.routes.appSetup}"><label for="organization">${ORG_LABEL}</label><input id="organization" name="organization" value="${organization}" aria-invalid="true" aria-describedby="tp-alert" autocomplete="off" autofocus>${alertBlock(`${organization} is not a GitHub organization login. A login holds letters, digits and hyphens.`, false)}<div class="tp-actions"><button class="tp-button tp-button-primary" type="submit">${CREATE_LABEL}<span aria-hidden="true"> ↗</span></button></div></form>`,
  next: appSetupNext(links),
  mark: null,
  fix: null,
  detail: `${organization} is not a GitHub organization login`,
  script: null,
});

export const appExistsPage = (links: Links, email: string, slug: string, htmlUrl: string): Page => ({
  title: "GitHub App already set up",
  email,
  body: p(
    `This stage already has the GitHub App ${slug}. A stage creates it once. Each tenant installs it from Connections.`,
  ),
  next: [primary("GitHub connections", connections(links)), secondary(`Open ${slug} on GitHub`, htmlUrl, true)],
  mark: "Done",
  fix: null,
  detail: "GitHub App already set up",
  script: null,
});

export const appCreatedPage = (links: Links, email: string, slug: string, htmlUrl: string): Page => ({
  title: "GitHub App created",
  email,
  body: p(
    `Created the GitHub App ${slug} for this stage. Each tenant installs it once, from onboarding or from Connections.`,
  ),
  next: [
    primary("Back to onboarding", onboarding(links)),
    secondary("GitHub connections", connections(links)),
    link(`Open ${slug} on GitHub`, htmlUrl, true),
  ],
  mark: "Done",
  fix: null,
  detail: "GitHub App created",
  script: null,
});

export const appNothingToCreatePage = (links: ServerLinks, email: string): Page =>
  errorPage(
    "Nothing to create",
    email,
    "GitHub sent no code and state, so there is no App to store.",
    "Start the App setup again.",
    [primary("Start again", links.routes.appSetup), report()],
  );

export const appRequestRefusedPage = (links: ServerLinks, email: string, detail: string): Page =>
  errorPage("Request refused", email, detail, "Start the App setup again while signed in as one person.", [
    primary("Start again", links.routes.appSetup),
    secondary("Sign in as another email", links.routes.signOut),
    report(),
  ]);

export const appGitHubRefusedPage = (links: ServerLinks, email: string, detail: string): Page =>
  errorPage(
    "GitHub refused the App",
    email,
    `${detail}. A conversion code works once and for an hour.`,
    "Start the App setup again.",
    [primary("Start again", links.routes.appSetup), report()],
  );

const installedNext = (links: Links, tenantId: string | null, first = "Connect from Tumpel"): NextStep[] => [
  primary(first, connections(links, tenantId)),
  secondary("Back to onboarding", onboarding(links, tenantId)),
  report(),
];

export interface LinkedInstallation {
  tenantId: string;
  accountLogin: string;
  settingsUrl: string;
}

export const gitHubConnectedPage = (links: Links, email: string, linked: LinkedInstallation): Page => ({
  title: "GitHub connected",
  email,
  body: p(
    `Your tenant now holds the GitHub App installation on ${linked.accountLogin}, next to any it held before. Each turn on a repository of ${linked.accountLogin} gets a token of its own.`,
  ),
  next: [
    primary("Back to onboarding", onboarding(links, linked.tenantId)),
    secondary("GitHub connections", connections(links, linked.tenantId)),
    link("Choose repositories on GitHub", linked.settingsUrl, true),
  ],
  mark: "Done",
  fix: null,
  detail: "GitHub connected",
  script: null,
});

export const installRefusedPage = (
  links: Links,
  email: string,
  tenantId: string | null,
  title: string,
  detail: string,
): Page =>
  errorPage(
    title,
    email,
    detail,
    "Connect again from Tumpel, or run tumpel github start on the CLI.",
    installedNext(links, tenantId),
  );

export interface InstallationChoice {
  email: string;
  accountLogin: string;
  action: string;
  choice: string;
  tenants: TenantChoice[];
}

export const installationChoicePage = (links: Links, request: InstallationChoice): Page => {
  const { email, accountLogin, action, choice, tenants } = request;
  const forms = tenants.map(
    (tenant) =>
      html`<form method="post" class="tp-form" action="${action}"><input type="hidden" name="choice" value="${choice}"><input type="hidden" name="tenant" value="${tenant.tenantId}"><div class="tp-actions"><button class="tp-button tp-button-primary" type="submit">Connect ${accountLogin} to ${tenant.name}</button></div></form>`,
  );
  return {
    title: "Connect GitHub",
    email,
    body: html`${p(`Connect the GitHub App installation on ${accountLogin} only if you started this installation yourself. Its repositories become available to every member of the tenant you choose.`)}${forms}`,
    next: [secondary("GitHub connections", connections(links)), link("Back to onboarding", onboarding(links))],
    mark: null,
    fix: null,
    detail: "Connect GitHub",
    script: null,
  };
};

export const installationRequestedPage = (links: Links, email: string, tenantId: string | null): Page => ({
  title: "Installation requested",
  email,
  body: p(
    "An owner of the GitHub organization must approve the installation. Once they approve it, connect again from Tumpel to finish.",
  ),
  next: [
    primary("GitHub connections", connections(links, tenantId)),
    secondary("Back to onboarding", onboarding(links, tenantId)),
  ],
  mark: "Waiting",
  fix: null,
  detail: "Installation requested",
  script: null,
});

export const installNothingToConnectPage = (links: Links, email: string): Page =>
  errorPage(
    "Nothing to connect",
    email,
    "GitHub sent no setup action, so there is no installation to link.",
    "Connect again from Tumpel.",
    installedNext(links, null),
  );

export const noGitHubAppPage = (links: ServerLinks, email: string, tenantId: string | null): Page =>
  errorPage(
    "No GitHub App",
    email,
    "This stage has no GitHub App, so there is nothing to install.",
    "Create the GitHub App, then connect again.",
    [
      primary("Create the GitHub App", links.routes.appSetup),
      secondary("GitHub connections", connections(links, tenantId)),
      report(),
    ],
  );

export const installerUnconfirmedPage = (links: Links, email: string, tenantId: string | null, detail: string): Page =>
  errorPage(
    "GitHub did not confirm the installer",
    email,
    `${detail}.`,
    "Connect again from Tumpel.",
    installedNext(links, tenantId, "Retry"),
  );

export const notTheInstallerPage = (links: Links, email: string, tenantId: string | null, detail: string): Page =>
  errorPage(
    "Not the installer",
    email,
    `${detail}.`,
    "Sign in to GitHub as the account that installed the App, or ask that person to connect it, then connect again from Tumpel.",
    installedNext(links, tenantId),
  );

export const installationInUsePage = (
  links: Links,
  email: string,
  tenantId: string | null,
  accountLogin: string,
  settingsUrl: string,
): Page =>
  errorPage(
    "Installation in use",
    email,
    `The installation on ${accountLogin} is linked to another tenant. Each installation serves one tenant.`,
    "Disconnect it in that tenant, or install the App on another account.",
    [
      primary("GitHub connections", connections(links, tenantId)),
      secondary("Choose repositories on GitHub", settingsUrl, true),
      report(),
    ],
  );

export const signInAgainPage = (links: Links, reason: string, url: string): Page =>
  errorPage(
    "Sign in again",
    null,
    `Cloudflare Access sent no valid sign-in for this browser: ${reason}.`,
    "Sign in again. Tumpel brings you back to this page.",
    [primary("Sign in again", url), secondary("Open dashboard", dashboard(links)), report()],
  );

export const noSuchPage = (links: Links, path: string): Page =>
  errorPage("No such page", null, `Tumpel has no page at ${path}.`, "Open the dashboard and pick up from there.", [
    primary("Open dashboard", dashboard(links)),
    report(),
  ]);

export const noReleasePage = (links: Links, url: string): Page =>
  errorPage(
    "No release published",
    null,
    "This stage has published no release yet, so there is no CLI or supervisor to download.",
    "Publish a release with the release workflow, then try again.",
    [primary("Retry", url), secondary("Open dashboard", dashboard(links)), report()],
  );

export const unreadableReleasePage = (links: Links, url: string, detail: string): Page =>
  errorPage(
    "The published release is unreadable",
    null,
    `${detail}.`,
    "Publish a release with the release workflow, then try again.",
    [primary("Retry", url), secondary("Open dashboard", dashboard(links)), report()],
  );

export type ReleaseBinary = "cli" | "supervisor";

const BINARY_NAMES: Record<ReleaseBinary, { title: string; fix: string }> = {
  cli: { title: "No CLI for this architecture", fix: "Download the Amd64 build, or run the CLI on an x86_64 machine." },
  supervisor: {
    title: "No supervisor for this architecture",
    fix: "Download the Amd64 build, or run the host on an x86_64 machine.",
  },
};

export const noBuildPage = (links: Links, binary: ReleaseBinary, detail: string, amd64Url: string): Page =>
  errorPage(BINARY_NAMES[binary].title, null, `${detail}.`, BINARY_NAMES[binary].fix, [
    primary("Download for Amd64", amd64Url),
    secondary("Open dashboard", dashboard(links)),
    report(),
  ]);

export const openRouterNotConnectedPage = (links: Links, detail: string): Page =>
  errorPage(
    "OpenRouter was not connected",
    null,
    detail,
    "Open the secret set in the dashboard and choose Connect OpenRouter again.",
    [primary("Open dashboard", dashboard(links)), report()],
  );
