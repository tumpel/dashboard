import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";
import { failureOf } from "../src/api/port.ts";
import { wordingOf } from "../src/api/wording.ts";
import { serviceUpdate } from "../src/service-update.ts";

let server: Server;
let origin: string;

before(async () => {
  server = createServer((request, response) => {
    if (request.url?.startsWith("/v1/events")) {
      const afterEventId = new URL(request.url, "http://localhost").searchParams.get("afterEventId");
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
        JSON.stringify(
          request.url.includes("knownOnly")
            ? [{ ...session("ses_known", { state: "Completed" }), futureField: { extra: "accepted" } }]
            : [
                session("ses_known", { state: "Completed" }),
                session("ses_newer", {
                  state: "Failed",
                  reason: "ReasonFromANewerControlPlane",
                  detail: "The control plane knows a reason this dashboard does not.",
                  failedAt: "2026-11-21T12:00:00Z",
                }),
                { ...session("ses_future_state", { state: "Suspended" }), state: "Recovering" },
              ],
        ),
      );
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        link: { state: "NotConnected" },
        reusableWorkflow: "tumpel/workflows/.github/workflows/prebuild.yml@v2",
        callerWorkflowExample: "on: push",
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("an answer missing a field becomes a named out-of-step problem", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const error = await api.getGitHubActionsConnection().then(
    () => assert.fail("the answer without tenantId parsed"),
    (rejection: unknown) => rejection,
  );
  assert.deepEqual(wordingOf(failureOf(error)), {
    title: "The dashboard and the API are out of step on GitHubActionsConnections_get",
    detail: "The GitHubActionsConnections_get answer does not match what this dashboard expects at tenantId.",
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
      ["TurnCompleted", 5],
    ],
  );
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

test("extra response fields remain usable without reporting an update", async () => {
  let reports = 0;
  const unsubscribe = serviceUpdate.subscribe(() => {
    reports++;
  });
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const sessions = await api.listSessions({ tag: ["knownOnly"] });
  unsubscribe();
  assert.equal(sessions[0]?.sessionId, "ses_known");
  assert.equal(reports, 0);
});

test("a session list keeps known fields alongside unknown response states and reasons", async () => {
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));
  const sessions = await api.listSessions({});
  assert.deepEqual(
    sessions.map((session) => [
      session.sessionId,
      session.lastTurn.state === "Failed" ? session.lastTurn.reason : session.lastTurn.state,
    ]),
    [
      ["ses_known", "Completed"],
      ["ses_newer", "Unrecognised"],
      ["ses_future_state", "Unrecognised"],
    ],
  );
  const [, failed, future] = sessions;
  assert.equal(failed?.lastTurn.state, "Failed");
  assert.equal(future?.state, "Unrecognised");
  assert.equal(future.lastTurnState, "Unrecognised");
  assert.equal(future.repository, "tumpel/dashboard");
  assert.equal(future.lastTurn.prompt, "Fix the bug.");
  assert.equal(future.lastTurn.turnId, "trn_1");
});
