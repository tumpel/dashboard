import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";
import { gitHubReturnOf } from "../src/github-return.ts";
import { installationSettingsUrl } from "../src/github-settings.ts";

const INSTALL_URL = "https://github.com/apps/example/installations/new?state=signed";
const asked: URL[] = [];
let server: Server;
let origin: string;

before(async () => {
  server = createServer((request, response) => {
    asked.push(new URL(request.url ?? "/", "http://stand-in"));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ installUrl: INSTALL_URL, expiresAt: "2026-11-16T18:30:00+00:00" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("adding an account starts without an account id and answers GitHub's install picker", async () => {
  const api = createHttpApi(
    origin,
    "tenant-a",
    async () => ({ kind: "Token", token: "token" }),
    (unrecognised) => assert.deepEqual(unrecognised, []),
  );
  const returnUrl = "https://app.tumpel.test/t/tenant-a/connections";
  const started = await api.startGitHubConnection(returnUrl, null);
  assert.equal(started.installUrl, INSTALL_URL);
  const request = asked.at(-1);
  assert.equal(request?.pathname, "/v1/github-connection/start");
  assert.deepEqual(Object.fromEntries(request?.searchParams ?? []), { returnUrl });
});

test("a return from GitHub reads as nothing to show, refused with a generated reason, or failed", () => {
  assert.deepEqual(gitHubReturnOf({}), { kind: "None" });
  assert.deepEqual(gitHubReturnOf({ from: ["github"] }), { kind: "None" });
  assert.deepEqual(gitHubReturnOf({ from: ["github"], refused: ["NotInstaller"], account: ["acme"] }), {
    kind: "Refused",
    reason: "NotInstaller",
    account: "acme",
  });
  assert.deepEqual(gitHubReturnOf({ from: ["github"], refused: ["Unknown"] }), { kind: "None" });
  assert.deepEqual(gitHubReturnOf({ from: ["github"], failed: ["GitHub answered 502"] }), {
    kind: "Failed",
    detail: "GitHub answered 502",
  });
});

test("an installation opens its settings on GitHub under the organization or the user account", () => {
  assert.equal(
    installationSettingsUrl({ installationId: 41, accountLogin: "acme", accountType: "Organization" }),
    "https://github.com/organizations/acme/settings/installations/41",
  );
  assert.equal(
    installationSettingsUrl({ installationId: 42, accountLogin: "octo", accountType: "User" }),
    "https://github.com/settings/installations/42",
  );
});
