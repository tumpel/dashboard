import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createHttpApi } from "../src/api/http.ts";

const session = (sessionId: string) => ({
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
  lastTurnState: "Completed",
  lastTurnAt: "2026-11-21T12:00:00Z",
  lastTurn: {
    turnId: "trn_1",
    tenantId: "tenant-a",
    sessionId,
    boxId: "box_1",
    prompt: "Fix the bug.",
    lineCount: 3,
    state: "Completed",
    createdAt: 1,
    updatedAt: 2,
  },
  boxRetention: "Auto",
  createdAt: 1,
  updatedAt: 2,
});

test("a tenant with 120 sessions lists every one across pages of 50, and every request carries limit", async () => {
  const tenantSessions = Array.from({ length: 120 }, (_, index) => `ses_${String(index).padStart(3, "0")}`);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push(url.search);
    const limit = Number(url.searchParams.get("limit"));
    const after = url.searchParams.get("after");
    const start = after === null ? 0 : tenantSessions.indexOf(after) + 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(tenantSessions.slice(start, start + limit).map(session)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = createHttpApi(origin, "tenant-a", async () => ({ kind: "Token", token: "token" }));

  const sessions = await api.listSessions({ triggerId: "trg_1" });
  await new Promise<void>((resolve) => server.close(() => resolve()));

  assert.deepEqual(
    sessions.map((listed) => listed.sessionId),
    tenantSessions,
  );
  assert.deepEqual(requests, [
    "?triggerId=trg_1&limit=50",
    "?triggerId=trg_1&limit=50&after=ses_049",
    "?triggerId=trg_1&limit=50&after=ses_099",
  ]);
});
