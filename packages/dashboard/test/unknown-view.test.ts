import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, Fragment } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { createHttpApi } from "../src/api/http.ts";
import { ServiceUpdateNotice } from "../src/components/service-update-notice.tsx";
import { SessionStateBadge } from "../src/components/status-badge.tsx";
import { createSignedOutStore, DashboardProvider } from "../src/context.tsx";
import type {} from "../src/router.tsx";
import { ConnectorRows } from "../src/screens/connectors.tsx";
import { OpenRouterSection } from "../src/screens/openrouter-connect.tsx";
import { serviceUpdate } from "../src/service-update.ts";

test("unknown connector and authorization responses render reload fallbacks and keep known work usable", async () => {
  const session = {
    sessionId: "ses_known",
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
    lastTurnState: "Completed",
    lastTurnAt: "2026-11-21T12:00:00Z",
    lastTurn: {
      turnId: "trn_1",
      tenantId: "tenant-a",
      sessionId: "ses_known",
      boxId: "box_1",
      prompt: "Keep working",
      lineCount: 3,
      createdAt: 1,
      updatedAt: 2,
      state: "Completed",
    },
    boxRetention: "Auto",
    createdAt: 1,
    updatedAt: 2,
  };
  let payload: unknown;
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const api = createHttpApi(`http://127.0.0.1:${address.port}`, "tenant-a", async () => ({
    kind: "Token",
    token: "test",
  }));
  let notifications = 0;
  const unsubscribe = serviceUpdate.subscribe(() => {
    notifications += 1;
  });
  try {
    for (const future of [
      { ...session, sessionId: "ses_enum", state: "FutureState" },
      { ...session, sessionId: "ses_extra", futureField: { new: true } },
    ]) {
      payload = [session, future];
      const before = notifications;
      const rows = await api.listSessions({});
      assert.equal(rows.length, "futureField" in future ? 2 : 1);
      assert.equal(rows[0]?.state, "Idle");
      assert.ok(notifications > before);
      const html = renderToStaticMarkup(
        createElement(
          Fragment,
          null,
          createElement(ServiceUpdateNotice),
          ...rows.map((row) => createElement(SessionStateBadge, { key: row.sessionId, state: row.state })),
        ),
      );
      assert.match(html, /The service sent something this dashboard does not recognise/);
      assert.match(html, /likely needs an update/);
      assert.match(html, /Idle/);
    }
    payload = [
      {
        auth: "OAuth",
        connectorId: "con_known",
        tenantId: "tenant-a",
        name: "Known connector",
        url: "https://example.com/mcp",
        status: { state: "Connected", connectedAt: "2026-11-21T12:00:00Z" },
        createdAt: 1,
        updatedAt: 2,
      },
      {
        auth: "OAuth",
        connectorId: "con_future",
        tenantId: "tenant-a",
        name: "Future connector",
        url: "https://example.com/mcp",
        status: {
          state: "AuthorizationFailed",
          reason: "FutureFailure",
          detail: "A future failure",
          failedAt: "2026-11-21T12:00:00Z",
        },
        createdAt: 1,
        updatedAt: 2,
      },
    ];
    const connectors = await api.listConnectors();
    const connectorHtml = renderToStaticMarkup(
      createElement(ConnectorRows, {
        connectors,
        personas: [],
        owner: true,
        pending: null,
        onAction: () => assert.fail("render must not perform actions"),
        onAuthorize: () => assert.fail("render must not authorize"),
      }),
    );
    assert.match(connectorHtml, /This dashboard doesn&#x27;t recognise what the service sent/);
    assert.match(connectorHtml, /Reload to update/);
    assert.match(connectorHtml, /Known connector/);
    assert.match(connectorHtml, /Authorize again/);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const status of [
      { state: "Failed", reason: "FutureFailure", detail: "Authorization failed", failedAt: "2026-11-21T12:00:00Z" },
      { state: "Completed", keyLabel: "Known key", completedAt: "2026-11-21T12:00:00Z" },
    ]) {
      payload = {
        openRouterAuthorizationId: "ora_1",
        tenantId: "tenant-a",
        principalId: "prn_1",
        secretSetId: "sst_1",
        status,
        createdAt: 1,
        updatedAt: 2,
      };
      client.setQueryData(
        ["tenant-a", "openRouterAuthorizations", "ora_1"],
        await api.getOpenRouterAuthorization("ora_1"),
      );
      const html = renderToStaticMarkup(
        jsx(DashboardProvider, {
          value: {
            signedOut: createSignedOutStore(),
            ports: {
              apiFor: () => api,
              apiOrigin: "https://example.com",
              now: () => 0,
              reportIssueUrl: "https://example.com/issues",
              auth: {
                signIn: async () => {
                  throw new Error("unused");
                },
                finishSignIn: async () => {
                  throw new Error("unused");
                },
                signedInTenants: () => [],
                signOut: async () => null,
              },
            },
          },
          children: jsx(QueryClientProvider, {
            client,
            children: createElement(OpenRouterSection, {
              tenantId: "tenant-a",
              secretSet: {
                secretSetId: "sst_1",
                tenantId: "tenant-a",
                name: "Keys",
                keys: [],
                createdAt: 1,
                updatedAt: 2,
              },
              openRouterAuthorizationId: "ora_1",
            }),
          }),
        }),
      );
      assert.match(
        html,
        status.state === "Failed"
          ? /This dashboard doesn&#x27;t recognise what the service sent/
          : /OpenRouter connected/,
      );
    }
    client.clear();
    payload = {
      events: [
        {
          event: "SubscriptionPaused",
          eventId: 1,
          tenantId: "tenant-a",
          createdAt: 1,
          subscriptionId: "sub_1",
          sessionId: "ses_known",
          reason: { kind: "FuturePause", extra: true },
        },
        {
          event: "SessionIdle",
          eventId: 2,
          tenantId: "tenant-a",
          createdAt: 2,
          sessionId: "ses_known",
          turnId: "trn_1",
        },
      ],
      lastEventId: 2,
    };
    const before = notifications;
    const page = await api.listEvents({});
    assert.equal(page.events.length, 1);
    assert.equal(page.events[0]?.event, "SessionIdle");
    assert.equal(page.lastEventId, 2);
    assert.ok(notifications > before);
    assert.match(renderToStaticMarkup(createElement(ServiceUpdateNotice)), /likely needs an update/);
  } finally {
    unsubscribe();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
