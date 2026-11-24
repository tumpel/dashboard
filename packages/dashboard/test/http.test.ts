import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";
import { failureOf } from "../src/api/port.ts";
import { ConnectorViewSchema, OpenRouterAuthorizationViewSchema } from "../src/api/responses.ts";
import { wordingOf } from "../src/api/wording.ts";
import { readRefusedStarts } from "../src/triggers.ts";

let server: Server;
let origin: string;

before(async () => {
  server = createServer((request, response) => {
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
          },
        ]),
      );
      return;
    }
    if (request.url?.startsWith("/v1/events")) {
      const query = new URL(request.url, "http://localhost").searchParams;
      const afterEventId = query.get("afterEventId");
      if (query.get("event") === "TriggerStartRefused") {
        const eventId = Number(afterEventId) + 1;
        const events =
          eventId > 2
            ? []
            : [
                {
                  event: "TriggerStartRefused",
                  eventId,
                  tenantId: "tenant-a",
                  createdAt: 1,
                  triggerId: "trg_1",
                  deliveryId: `delivery-${eventId}`,
                  refusal:
                    eventId === 1
                      ? { code: "NewRefusal", detail: "A newer capacity rule." }
                      : { code: "InvalidRequest", detail: "A known refusal." },
                },
              ];
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ events, lastEventId: Math.min(eventId, 2) }));
        return;
      }
      if (afterEventId === "1" || afterEventId === "2") {
        const known = {
          event: "TurnCompleted",
          eventId: 2,
          tenantId: "tenant-a",
          createdAt: 1,
          turnId: "trn_1",
          sessionId: "ses_1",
        };
        const paused = {
          ...known,
          event: "SubscriptionPaused",
          eventId: 3,
          subscriptionId: "sub_1",
          reason: { kind: "NewPauseReason" },
        };
        const future = { event: "NewEvent", eventId: 4, tenantId: "tenant-a", createdAt: 1 };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            events:
              afterEventId === "1"
                ? [known, paused, future, { ...known, eventId: 5 }]
                : [known, { ...paused, sessionId: null }],
            lastEventId: afterEventId === "1" ? 5 : 3,
          }),
        );
        return;
      }
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
          session("ses_known", { state: "Completed" }),
          session("ses_host_dropped", {
            state: "Failed",
            reason: "HostDropped",
            detail: "The host disconnected while the turn was running.",
            failedAt: "2026-11-21T12:00:00Z",
          }),
          {
            ...session("ses_newer", {
              state: "Failed",
              reason: "ReasonFromANewerControlPlane",
              detail: "The control plane knows a reason this dashboard does not.",
              failedAt: "2026-11-21T12:00:00Z",
              image: { kind: "NewImage" },
            }),
            harness: "NewHarness",
            boxRetention: "NewRetention",
            origin: { kind: "NewOrigin" },
            startedBy: { kind: "NewActor" },
            lastTurnImage: { kind: "NewImage" },
            prebuildLayer: { layer: "NewLayer" },
          },
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("a prebuild without a provider parses", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const prebuilds = await api.listLatestPrebuilds();
  assert.deepEqual(
    prebuilds.map(({ prebuildId, repository, status }) => [prebuildId, repository, status.state]),
    [["pbd_control_plane", "https://github.com/owner/control-plane-prebuild", "Building"]],
  );
});

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

test("an expired event cursor keeps its oldest event id", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
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

test("an event page keeps known events around unknown event names and pause reasons", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const page = await api.listEvents({ afterEventId: 1 });
  assert.deepEqual(
    page.events.map(({ event, eventId }) => [event, eventId]),
    [
      ["TurnCompleted", 2],
      ["SubscriptionPaused", 3],
      ["TurnCompleted", 5],
    ],
  );
  const pause = page.events.find((event) => event.event === "SubscriptionPaused");
  assert.deepEqual(pause?.reason, { kind: "Unrecognised" });
  assert.equal(page.lastEventId, 5);
});

test("an unknown response value does not hide another malformed field on the event", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  await assert.rejects(api.listEvents({ afterEventId: 2 }), (error: unknown) => {
    const failure = failureOf(error);
    assert.equal(failure.kind, "OutOfStep");
    assert.match(failure.detail, /events\.1\.sessionId/);
    return true;
  });
});

test("a newer refusal code retains the event and the rest of the history", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const refusals = await readRefusedStarts(api.listEvents, "trg_1");
  assert.deepEqual(
    refusals.map(({ deliveryId, refusal }) => [deliveryId, refusal]),
    [
      ["delivery-1", { code: "Unrecognised", detail: "A newer capacity rule." }],
      ["delivery-2", { code: "InvalidRequest", detail: "A known refusal." }],
    ],
  );
});

test("an unfamiliar authorization failure reason retains the known failure fields", () => {
  const record = { tenantId: "tenant-a", createdAt: 1, updatedAt: 2 };
  const failure = {
    reason: "NewFailureReason",
    detail: "The provider refused access.",
    failedAt: "2026-11-21T12:00:00Z",
  };
  const connector = ConnectorViewSchema.parse({
    ...record,
    connectorId: "con_1",
    auth: "OAuth",
    name: "Example",
    url: "https://example.com",
    status: { ...failure, state: "AuthorizationFailed" },
  });
  const authorization = OpenRouterAuthorizationViewSchema.parse({
    ...record,
    openRouterAuthorizationId: "ora_1",
    principalId: "prn_1",
    secretSetId: "set_1",
    status: { ...failure, state: "Failed" },
  });
  assert.deepEqual(connector.status, { ...failure, state: "AuthorizationFailed", reason: "Unrecognised" });
  assert.deepEqual(authorization.status, { ...failure, state: "Failed", reason: "Unrecognised" });
});

test("a session list preserves familiar failures and rows with unfamiliar values", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const sessions = await api.listSessions({});
  assert.deepEqual(
    sessions.map((session) => [
      session.sessionId,
      session.lastTurn.state === "Failed" ? session.lastTurn.reason : session.lastTurn.state,
    ]),
    [
      ["ses_known", "Completed"],
      ["ses_host_dropped", "HostDropped"],
      ["ses_newer", "Unrecognised"],
    ],
  );
  const newer = sessions.find((session) => session.sessionId === "ses_newer");
  assert.equal(newer?.harness, "Unrecognised");
  assert.equal(newer.boxRetention, "Unrecognised");
  assert.deepEqual(newer.origin, { kind: "Unrecognised" });
  assert.deepEqual(newer.startedBy, { kind: "Unrecognised" });
  assert.deepEqual(newer.lastTurn.image, { kind: "Unrecognised" });
  assert.deepEqual(newer.lastTurnImage, { kind: "Unrecognised" });
  assert.deepEqual(newer.prebuildLayer, { layer: "Unrecognised" });
});
