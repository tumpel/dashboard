import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectorViewSchema } from "../src/api/responses.ts";
import type {} from "../src/router.tsx";
import { ConnectorRows } from "../src/screens/connectors.tsx";

test("an unknown authorization reason renders a reload fallback and keeps known connectors usable", () => {
  const connector = {
    auth: "OAuth",
    connectorId: "con_known",
    tenantId: "tenant-a",
    name: "Known connector",
    url: "https://example.com/mcp",
    status: { state: "Connected", connectedAt: "2026-11-21T12:00:00Z" },
    createdAt: 1,
    updatedAt: 2,
  };
  const connectors = [
    ConnectorViewSchema.parse(connector),
    ConnectorViewSchema.parse({
      ...connector,
      connectorId: "con_future",
      name: "Future connector",
      status: {
        state: "AuthorizationFailed",
        reason: "FutureFailure",
        detail: "A future failure",
        failedAt: "2026-11-21T12:00:00Z",
      },
    }),
  ];
  const html = renderToStaticMarkup(
    createElement(ConnectorRows, {
      connectors,
      personas: [],
      owner: true,
      pending: null,
      onAction: () => assert.fail("render must not perform actions"),
      onAuthorize: () => assert.fail("render must not authorize"),
    }),
  );
  assert.match(html, /This dashboard doesn&#x27;t recognise what the service sent/);
  assert.match(html, /Reload to update/);
  assert.match(html, /Known connector/);
  assert.match(html, /Authorize again/);
});
