import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptPage, linksFor, type ServerLinks } from "../src/index.ts";
import { shellDocument } from "../src/shell.ts";

const HOSTILE = `"><script>alert(1)</script>`;

const LINKS: ServerLinks = {
  ...linksFor({ dashboard: "https://dashboard.test", api: "https://api.test" }),
  routes: {
    signOut: "https://api.test/sign-out",
    device: "https://api.test/device",
    appSetup: "https://api.test/app-setup",
    createTenant: "https://api.test/tenants",
    approveDevice: "https://api.test/approve",
    denyDevice: "https://api.test/deny",
    acceptInvitation: "https://api.test/accept",
  },
};

test("the shell escapes every value a page interpolates", () => {
  const page = acceptPage(LINKS, {
    email: HOSTILE,
    tenantName: HOSTILE,
    role: "Member",
    token: HOSTILE,
    next: LINKS.dashboard,
  });
  const document = shellDocument(
    page,
    { links: LINKS, path: `/invitations/accept?token=${HOSTILE}`, at: new Date(0) },
    {
      tokens: "",
      shell: "",
    },
  );
  const markup = document.slice(0, document.indexOf("<script>const DROPPED"));
  assert.ok(!markup.includes("<script>alert(1)</script>"), "a value reached the markup unescaped");
  const script = document.slice(document.indexOf("<script>const DROPPED"));
  assert.ok(!script.includes("</script><script>"), "a value closed the page script");
});
