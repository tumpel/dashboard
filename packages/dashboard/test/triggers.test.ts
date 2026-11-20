import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiFailure, type EventQuery, type TriggerStartRefused } from "../src/api/port.ts";
import { parsePayload, readRefusedStarts, runsOf } from "../src/triggers.ts";

test("runs merge the trigger's sessions and refusals, newest first, and skip every other start", () => {
  const sessions = [
    { createdAt: 100, startedBy: { kind: "Trigger", triggerId: "trg_1", deliveryId: "d1" } },
    { createdAt: 300, startedBy: { kind: "Trigger", triggerId: "trg_1", deliveryId: "d3" } },
    { createdAt: 400, startedBy: { kind: "Trigger", triggerId: "trg_2", deliveryId: "d4" } },
    { createdAt: 500, startedBy: { kind: "Person", principalId: "prn_1" } },
  ] as const;
  const refusals: TriggerStartRefused[] = [
    {
      event: "TriggerStartRefused",
      eventId: 7,
      tenantId: "tnt_1",
      createdAt: 200,
      triggerId: "trg_1",
      deliveryId: "d2",
      refusal: { code: "NoHostOnline", detail: "No host is online." },
    },
    {
      event: "TriggerStartRefused",
      eventId: 9,
      tenantId: "tnt_1",
      createdAt: 600,
      triggerId: "trg_2",
      deliveryId: "d5",
      refusal: { code: "NoHostOnline", detail: "No host is online." },
    },
  ];
  assert.deepEqual(
    runsOf("trg_1", sessions, refusals).map((run) => [run.kind, run.deliveryId]),
    [
      ["Session", "d3"],
      ["Refused", "d2"],
      ["Session", "d1"],
    ],
  );
});

test("a refused-start read that meets an expired cursor keeps what it read and says the log moved on", async () => {
  const refused: TriggerStartRefused = {
    event: "TriggerStartRefused",
    eventId: 57,
    tenantId: "tnt_1",
    createdAt: 57,
    triggerId: "trg_1",
    deliveryId: "d57",
    refusal: { code: "NoHostOnline", detail: "No host is online." },
  };
  const listEvents = async (query: EventQuery) => {
    if (query.afterEventId === 0) return { events: [refused], lastEventId: 57 };
    throw new ApiFailure({
      kind: "Problem",
      status: 410,
      problem: { code: "EventCursorExpired", title: "Event cursor expired", detail: "gone", fix: "read on" },
    });
  };
  assert.deepEqual(await readRefusedStarts(listEvents, "trg_1"), { refused: [refused], expired: true });
});

test("a pasted payload must be a JSON object", () => {
  assert.deepEqual(parsePayload('{ "action": "closed" }'), { ok: true, payload: { action: "closed" } });
  assert.deepEqual(parsePayload("[1]"), {
    ok: false,
    reason: "The payload must be a JSON object, as GitHub sends it.",
  });
  assert.equal(parsePayload("{ action").ok, false);
});
