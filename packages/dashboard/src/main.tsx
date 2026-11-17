import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { SHARED_LINKS } from "@tumpel/pages";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHttpApi } from "./api/http";
import type { TumpelApi } from "./api/port";
import { App } from "./app";
import { createAuth } from "./auth/oauth";
import "./styles.css";

const apiOrigin = import.meta.env.VITE_TUMPEL_API_ORIGIN;
if (!apiOrigin) {
  throw new Error(
    "VITE_TUMPEL_API_ORIGIN is not set; build the dashboard with it set to the control plane origin, as npm run deploy does",
  );
}
const auth = createAuth(apiOrigin, window.location.origin);
const apis = new Map<string, TumpelApi>();
const apiFor = (tenantId: string): TumpelApi => {
  const api = apis.get(tenantId) ?? createHttpApi(apiOrigin, tenantId, auth.accessToken);
  apis.set(tenantId, api);
  return api;
};

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element; restore it");

createRoot(root).render(
  <StrictMode>
    <App ports={{ apiFor, apiOrigin, auth, reportIssueUrl: SHARED_LINKS.report, now: Date.now }} />
  </StrictMode>,
);
