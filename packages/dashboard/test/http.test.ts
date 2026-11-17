import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";
import { failureOf } from "../src/api/port.ts";
import { wordingOf } from "../src/api/wording.ts";

let server: Server;
let origin: string;

before(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        app: { state: "Ready", appSlug: "example" },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("an answer missing a field becomes a named out-of-step problem", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const error = await api.getGitHubConnection().then(
    () => assert.fail("the answer without tenantId parsed"),
    (rejection: unknown) => rejection,
  );
  assert.deepEqual(wordingOf(failureOf(error)), {
    title: "The dashboard and the API are out of step on GitHubConnections_get",
    detail: "The GitHubConnections_get answer does not match what this dashboard expects at tenantId.",
    fix: "Reload; if it stays, the deploy is still rolling.",
  });
});
