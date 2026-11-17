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

const VIEWPORTS = [
  { name: "Desktop", width: 1024, height: 720 },
  { name: "Phone", width: 390, height: 844 },
] as const;

export const ServerPage = ({ page, path }: { page: Page; path: string }) => {
  const document = shellDocument(page, contextAt(path), { tokens, shell });
  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      {VIEWPORTS.map((viewport) => (
        <figure key={viewport.name} className="m-0 grid gap-2">
          <figcaption className="text-sm text-muted-foreground">
            {viewport.name}, {viewport.width} px
          </figcaption>
          <iframe
            title={`${page.title}, ${viewport.name}`}
            srcDoc={document}
            width={viewport.width}
            height={viewport.height}
            className="rounded-md border bg-card"
          />
        </figure>
      ))}
    </div>
  );
};
