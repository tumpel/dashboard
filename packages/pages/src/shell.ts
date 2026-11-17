import { DASHBOARD_PATHS, FONT_FILES, type Links, reportUrl } from "./links.ts";

export interface Html {
  readonly html: string;
}

type Value = string | number | Html | Html[];

export const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const isHtml = (value: Value): value is Html => typeof value === "object" && !Array.isArray(value);

const valueHtml = (value: Value): string => {
  if (Array.isArray(value)) return value.map((each) => each.html).join("");
  if (isHtml(value)) return value.html;
  return escapeHtml(String(value));
};

export const html = (strings: TemplateStringsArray, ...values: Value[]): Html => ({
  html: strings.reduce((out, part, index) => {
    const value = values[index - 1];
    return out + (value === undefined ? "" : valueHtml(value)) + part;
  }),
});

export const NO_HTML: Html = { html: "" };

export type Mark = "Done" | "Waiting" | "Error";

export type StepKind = "Primary" | "Secondary" | "Link" | "Report";

export interface NextStep {
  kind: StepKind;
  label: string;
  href: string;
  external: boolean;
  hidden: boolean;
}

export interface Page {
  title: string;
  mark: Mark | null;
  email: string | null;
  body: Html;
  fix: string | null;
  detail: string;
  next: NextStep[];
  script: string | null;
}

export interface PageContext {
  links: Links;
  path: string;
  at: Date;
}

export const SHELL_MARKER = 'data-shell="tumpel-page"';

const MARK_ICONS: Record<Mark, string> = {
  Done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--card)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  Waiting:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6.5V12l3.6 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Error:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7" stroke="var(--card)" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.4" fill="var(--card)"/></svg>',
};

const markHtml = (mark: Mark | null): Html =>
  mark === null
    ? NO_HTML
    : html`<span class="tp-mark tp-mark-${mark.toLowerCase()}" role="img" aria-label="${mark}">${{ html: MARK_ICONS[mark] }}</span>`;

const reportHref = (page: Page, context: PageContext): string =>
  reportUrl(context.links, page.title, page.detail, context.path, context.at);

const stepHref = (step: NextStep, page: Page, context: PageContext): string =>
  step.kind === "Report" ? reportHref(page, context) : step.href;

const opens = (external: boolean): Html => (external ? html` target="_blank" rel="noreferrer"` : NO_HTML);

const stepHtml = (step: NextStep, page: Page, context: PageContext): Html => {
  const external = step.external || step.kind === "Report";
  const hidden = step.hidden ? html` hidden` : NO_HTML;
  const arrow = step.external ? html`<span aria-hidden="true"> ↗</span>` : NO_HTML;
  const href = stepHref(step, page, context);
  if (step.kind === "Primary" || step.kind === "Secondary") {
    const variant = step.kind === "Primary" ? " tp-button-primary" : "";
    return html`<a class="tp-button${variant}" href="${href}"${opens(external)}${hidden}>${step.label}${arrow}</a>`;
  }
  const id = step.kind === "Report" ? html` id="tp-report"` : NO_HTML;
  return html`<a href="${href}"${id}${opens(external)}${hidden}>${step.label}${arrow}</a>`;
};

const nextHtml = (page: Page, context: PageContext): Html => {
  if (page.next.length === 0) return NO_HTML;
  const buttons = page.next.filter((step) => step.kind === "Primary" || step.kind === "Secondary");
  if (buttons.length > 2) {
    throw new Error(`the page ${page.title} names ${buttons.length} next-step buttons; the shell holds two at most`);
  }
  const links = page.next.filter((step) => step.kind === "Link" || step.kind === "Report");
  const buttonRow =
    buttons.length === 0
      ? NO_HTML
      : html`<div class="tp-next-buttons">${buttons.map((step) => stepHtml(step, page, context))}</div>`;
  const linkRow =
    links.length === 0
      ? NO_HTML
      : html`<div class="tp-next-links">${links.map((step) => stepHtml(step, page, context))}</div>`;
  return html`<nav class="tp-next" aria-label="Next steps">${buttonRow}${linkRow}</nav>`;
};

const whoHtml = (page: Page, links: Links): Html => {
  if (page.email !== null) return html`<span class="tp-who tp-who-email">${page.email}</span>`;
  return html`<a class="tp-who" href="${links.dashboard}${DASHBOARD_PATHS.signIn}">Sign in</a>`;
};

export const mainHtml = (page: Page, context: PageContext): Html => {
  const under = page.email === null ? NO_HTML : html`<p class="tp-who-under">Signed in as ${page.email}</p>`;
  const fix = page.fix === null ? NO_HTML : html`<p class="tp-fix">Fix: ${page.fix}</p>`;
  return html`<h1 class="tp-title" tabindex="-1">${markHtml(page.mark)}<span>${page.title}</span></h1>${under}<div class="tp-content">${page.body}${fix}</div>${nextHtml(page, context)}`;
};

export const shellBody = (page: Page, context: PageContext): string => {
  const { links } = context;
  return html`<div class="tp-page" ${{ html: SHELL_MARKER }}>
<header class="tp-header"><div class="tp-bar"><a class="tp-brand" href="${links.dashboard}/"><img src="${links.dashboard}/logo128.png" alt="" width="28" height="28"><span>Tumpel</span></a>${whoHtml(page, links)}</div></header>
<main class="tp-main" id="tp-main">${mainHtml(page, context)}</main>
<footer class="tp-footer"><nav aria-label="Tumpel"><a href="${links.dashboard}/">Dashboard</a><a href="${links.docs}" target="_blank" rel="noreferrer">Docs</a><a href="${links.cli}">Download the CLI</a><a href="${links.github}" target="_blank" rel="noreferrer">GitHub</a><a href="${reportHref(page, context)}" target="_blank" rel="noreferrer">Report an issue</a></nav></footer>
</div>`.html;
};

const fontFaces = (links: Links): string =>
  `@font-face{font-family:"Inter Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url(${links.dashboard}${FONT_FILES.sans}) format("woff2")}@font-face{font-family:"JetBrains Mono Variable";font-style:normal;font-display:swap;font-weight:100 800;src:url(${links.dashboard}${FONT_FILES.mono}) format("woff2")}`;

export interface ShellCss {
  tokens: string;
  shell: string;
}

export const shellDocument = (page: Page, context: PageContext, css: ShellCss): string => {
  const script = page.script === null ? "" : `<script>${page.script}</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(page.title)} · Tumpel</title><link rel="icon" type="image/png" href="${escapeHtml(context.links.dashboard)}/logo32.png"><style>${fontFaces(context.links)}${css.tokens}body{margin:0}${css.shell}</style></head><body>${shellBody(page, context)}${script}</body></html>`;
};
