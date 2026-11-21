import { linksFor, type Page, type PageContext, type ServerLinks, shellDocument } from "@tumpel/pages";
import shell from "@tumpel/pages/shell.css?raw";
import tokens from "@tumpel/pages/tokens.css?raw";

export const LINKS: ServerLinks = {
  ...linksFor({ dashboard: window.location.origin, api: window.location.origin }),
  routes: {
    signOut: "#sign-out",
    device: "#device",
    appSetup: "#app-setup",
    createTenant: "#create-tenant",
    approveDevice: "#approve-device",
    denyDevice: "#deny-device",
    acceptInvitation: "#accept-invitation",
  },
};
export const WHO = "sender@example.com";
export const AT = new Date("2026-11-15T14:02:11+01:00");

export const contextAt = (path: string): PageContext => ({ links: LINKS, path, at: AT });

export const ServerPage = ({ page, path }: { page: Page; path: string }) => {
  const document = shellDocument(page, contextAt(path), { tokens, shell });
  return <iframe title={page.title} srcDoc={document} className="block h-dvh w-full border-0 bg-card" />;
};
