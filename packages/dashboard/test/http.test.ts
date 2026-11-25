import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";
import { failureOf } from "../src/api/port.ts";
import { updateNotice, wordingOf } from "../src/api/wording.ts";
import { knownPersona, knownSecretSet } from "../src/fleet.ts";

let server: Server;
let origin: string;
let notices: string[] = [];

const apiWithNotices = () => {
  notices = [];
  return createHttpApi(
    origin,
    "tenant-a",
    async () => ({ kind: "Token", token: "token" }),
    (unrecognised) => notices.push(updateNotice(unrecognised).detail),
  );
};

const NOTICE = "The service sent something this version does not recognise:";

const event = (fields: Record<string, unknown>) => ({ tenantId: "tenant-a", createdAt: 1, ...fields });

before(async () => {
  server = createServer((request, response) => {
    if (request.url === "/v1/secret-sets/sst_newer") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          secretSetId: "sst_newer",
          tenantId: "tenant-a",
          name: "newer",
          keys: [
            { kind: "Variable", name: "NPM_TOKEN", updatedAt: 1 },
            { kind: "KindFromANewerControlPlane", name: "NEWER", updatedAt: 1 },
          ],
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      return;
    }
    if (request.url === "/v1/personas/per_newer") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          personaId: "per_newer",
          tenantId: "tenant-a",
          name: "newer",
          harness: "ClaudeCode",
          secretSetId: "sst_newer",
          connectorIds: [],
          boxRetention: "Auto",
          tumpelMcp: true,
          files: [
            {
              source: "Inline",
              path: "CLAUDE.md",
              content: "",
              digest: "0".repeat(64),
              sizeBytes: 0,
              createdAt: 1,
              updatedAt: 1,
            },
            { source: "SourceFromANewerControlPlane", path: "NEWER.md", createdAt: 1, updatedAt: 1 },
          ],
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      return;
    }
    if (request.url === "/v1/prebuilds/latest") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify([
          {
            prebuildId: "pbd_control_plane",
            tenantId: "tenant-a",
            personaId: "per_1",
            repository: "https://github.com/owner/control-plane-prebuild",
            inputDigest: "3f".repeat(32),
            guestImageDigest: "7c".repeat(32),
            configSource: "RepositoryFile",
            status: { state: "Building" },
            startedAt: "2026-11-15T13:02:00Z",
            logUrl: "https://api.example.com/v1/sessions/ses_prebuild/transcript",
            createdAt: Date.parse("2026-11-15T13:02:00Z"),
            updatedAt: Date.parse("2026-11-15T13:02:00Z"),
            fieldFromANewerControlPlane: "ignored",
          },
        ]),
      );
      return;
    }
    if (request.url === "/v1/events?afterEventId=1") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          events: [
            event({
              event: "SubscriptionPaused",
              eventId: 2,
              subscriptionId: "sub_1",
              sessionId: "ses_1",
              reason: { kind: "PauseReasonFromANewerControlPlane" },
            }),
            event({ event: "EventFromANewerControlPlane", eventId: 3 }),
          ],
          lastEventId: 3,
        }),
      );
      return;
    }
    if (request.url?.startsWith("/v1/events")) {
      response.writeHead(410, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          code: "EventCursorExpired",
          title: "Event cursor expired",
          detail: "The event cursor expired.",
          fix: "Read the current state, then read events from its event id.",
          oldestEventId: 50,
        }),
      );
      return;
    }
    if (request.url?.startsWith("/v1/sessions")) {
      const session = (sessionId: string, lastTurn: Record<string, unknown>) => ({
        sessionId,
        tenantId: "tenant-a",
        principalId: "prn_1",
        hostId: "hst_1",
        boxId: "box_1",
        personaId: "per_1",
        repository: "tumpel/dashboard",
        origin: { kind: "Prompt" },
        startedBy: { kind: "Person", principalId: "prn_1" },
        tags: [],
        harness: "ClaudeCode",
        harnessVersion: "2.1.4",
        model: "a-model",
        state: "Idle",
        lastTurnId: "trn_1",
        lastTurnState: lastTurn.state,
        lastTurnAt: "2026-11-21T12:00:00Z",
        lastTurn: {
          turnId: "trn_1",
          tenantId: "tenant-a",
          sessionId,
          boxId: "box_1",
          prompt: "Fix the bug.",
          lineCount: 3,
          createdAt: 1,
          updatedAt: 2,
          ...lastTurn,
        },
        boxRetention: "Auto",
        createdAt: 1,
        updatedAt: 2,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify([
          { ...session("ses_known", { state: "Completed" }), state: "StateFromANewerControlPlane" },
          session("ses_host_dropped", {
            state: "Failed",
            reason: "HostDropped",
            detail: "The host disconnected while the turn was running.",
            failedAt: "2026-11-21T12:00:00Z",
          }),
          session("ses_newer", {
            state: "Failed",
            reason: "ReasonFromANewerControlPlane",
            detail: "The control plane knows a reason this dashboard does not.",
            failedAt: "2026-11-21T12:00:00Z",
          }),
        ]),
      );
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        app: { state: "Ready", appSlug: "example" },
      }),
    );
  });
  server.on("upgrade", (request, socket) => {
    socket.on("data", () => socket.destroy());
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: tumpel.bearer\r\n\r\n`,
    );
    for (const sent of [
      event({ event: "EventFromANewerControlPlane", eventId: 4 }),
      event({ event: "TurnStarted", eventId: 5, turnId: "trn_1", sessionId: "ses_1" }),
    ]) {
      const text = Buffer.from(JSON.stringify(sent));
      socket.write(Buffer.concat([Buffer.from([0x81, text.length]), text]));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("a prebuild without a provider parses, and its extra field raises no notice", async () => {
  const api = apiWithNotices();
  const prebuilds = await api.listLatestPrebuilds();
  assert.deepEqual(
    prebuilds.map(({ prebuildId, repository, status }) => [prebuildId, repository, status.state]),
    [["pbd_control_plane", "https://github.com/owner/control-plane-prebuild", "Building"]],
  );
  assert.deepEqual(notices, []);
});

test("an answer missing a field becomes a named out-of-step problem", async () => {
  const api = apiWithNotices();
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

test("an expired event cursor keeps its oldest event id", async () => {
  const api = apiWithNotices();
  const error = await api.listEvents({ afterEventId: 0 }).then(
    () => assert.fail("the expired cursor succeeded"),
    (rejection: unknown) => rejection,
  );
  const failure = failureOf(error);
  assert.equal(
    failure.kind === "Problem" && "oldestEventId" in failure.problem ? failure.problem.oldestEventId : null,
    50,
  );
});

test("a session list keeps its IDs and names an unknown state and failure reason in one notice", async () => {
  const api = apiWithNotices();
  const sessions = await api.listSessions({});
  assert.deepEqual(
    sessions.map((session) => [
      session.sessionId,
      session.state,
      session.lastTurn.state === "Failed" ? session.lastTurn.reason : session.lastTurn.state,
    ]),
    [
      ["ses_known", "Unrecognised", "Completed"],
      ["ses_host_dropped", "Idle", "HostDropped"],
      ["ses_newer", "Idle", "Unrecognised"],
    ],
  );
  assert.deepEqual(notices, [`${NOTICE} "StateFromANewerControlPlane", "ReasonFromANewerControlPlane".`]);
});

test("an event page keeps its IDs and names an unknown pause reason and event type", async () => {
  const api = apiWithNotices();
  const page = await api.listEvents({ afterEventId: 1 });
  assert.deepEqual(
    page.events.map((listed) => [listed.eventId, listed.event]),
    [
      [2, "SubscriptionPaused"],
      [3, "Unrecognised"],
    ],
  );
  assert.deepEqual(notices, [`${NOTICE} "PauseReasonFromANewerControlPlane", "EventFromANewerControlPlane".`]);
});

test("the events socket drops an unknown event type with a notice and no gap", async () => {
  const api = apiWithNotices();
  let gaps = 0;
  const received = await new Promise<number[]>((resolve) => {
    const stop = api.followEvents({
      onEvent: (followed) => {
        stop();
        resolve([followed.eventId]);
      },
      onGap: () => {
        gaps += 1;
      },
    });
  });
  assert.deepEqual(received, [5]);
  assert.equal(gaps, 0);
  assert.deepEqual(notices, [`${NOTICE} "EventFromANewerControlPlane".`]);
});

test("a secret set or persona holding an unknown member offers no save", async () => {
  const api = apiWithNotices();
  const secretSet = await api.getSecretSet("sst_newer");
  const persona = await api.getPersona("per_newer");
  assert.deepEqual(
    [secretSet.secretSetId, persona.personaId, knownSecretSet(secretSet), knownPersona(persona)],
    ["sst_newer", "per_newer", null, null],
  );
  assert.deepEqual(notices, [`${NOTICE} "KindFromANewerControlPlane".`, `${NOTICE} "SourceFromANewerControlPlane".`]);
  const known = { ...secretSet, keys: secretSet.keys.filter((key) => key.kind !== "Unrecognised") };
  assert.deepEqual(knownSecretSet(known)?.keys, [{ kind: "Variable", name: "NPM_TOKEN", updatedAt: 1 }]);
});
