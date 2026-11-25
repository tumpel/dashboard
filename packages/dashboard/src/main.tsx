import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { SHARED_LINKS } from "@tumpel/pages";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHttpApi } from "./api/http";
import type { TumpelApi } from "./api/port";
import type { Wording } from "./api/wording";
import { API_ORIGIN_META, readApiOrigin } from "./api-origin";
import { App } from "./app";
import { createAuth } from "./auth/oauth";
import { reportLink } from "./components/problem-block";
import { notifyUpdate } from "./shell/app-shell";
import "./styles.css";

const StartupFailure = ({ wording }: { wording: Wording }) => (
  <div role="alert" className="m-6 max-w-2xl rounded-lg border-2 border-destructive bg-card p-4">
    <h1 className="font-semibold">{wording.title}</h1>
    <p className="text-sm">{wording.detail}</p>
    <p className="text-sm text-muted-foreground">{wording.fix}</p>
    <a
      className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
      href={reportLink(SHARED_LINKS.report, wording)}
      target="_blank"
      rel="noreferrer"
    >
      Report an issue
    </a>
  </div>
);

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element; restore it");

const read = readApiOrigin(document.querySelector(`meta[name="${API_ORIGIN_META}"]`)?.getAttribute("content") ?? null);
if (!read.ok) {
  createRoot(root).render(<StartupFailure wording={read.wording} />);
  throw new Error(`${read.wording.detail} ${read.wording.fix}`);
}

const apiOrigin = read.origin;
const auth = createAuth(apiOrigin, window.location.origin);
const apis = new Map<string, TumpelApi>();
const apiFor = (tenantId: string): TumpelApi => {
  const api = apis.get(tenantId) ?? createHttpApi(apiOrigin, tenantId, auth.accessToken, notifyUpdate);
  apis.set(tenantId, api);
  return api;
};

createRoot(root).render(
  <StrictMode>
    <App ports={{ apiFor, apiOrigin, auth, reportIssueUrl: SHARED_LINKS.report, now: Date.now }} />
  </StrictMode>,
);
