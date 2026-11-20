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

test("a refused-start read past an expired start of the log reads on from the oldest event kept", async () => {
  const kept: TriggerStartRefused[] = [57, 80, 119].map((eventId) => ({
    event: "TriggerStartRefused",
    eventId,
    tenantId: "tnt_1",
    createdAt: eventId,
    triggerId: "trg_1",
    deliveryId: `d${eventId}`,
    refusal: { code: "NoHostOnline", detail: "No host is online." },
  }));
  const oldest = 50;
  const end = 120;
  const listEvents = async (query: EventQuery) => {
    const after = query.afterEventId;
    if (after === undefined) return { events: [], lastEventId: end };
    if (after < oldest - 1) {
      throw new ApiFailure({
        kind: "Problem",
        status: 410,
        problem: { code: "EventCursorExpired", title: "Event cursor expired", detail: "gone", fix: "read on" },
      });
    }
    const events = kept.filter((event) => event.eventId > after).slice(0, 2);
    return { events, lastEventId: events.length === 2 ? (events.at(-1)?.eventId ?? end) : end };
  };
  assert.deepEqual(
    (await readRefusedStarts(listEvents, "trg_1")).map((event) => event.eventId),
    [57, 80, 119],
  );
});

test("a pasted payload must be a JSON object", () => {
  assert.deepEqual(parsePayload('{ "action": "closed" }'), { ok: true, payload: { action: "closed" } });
  assert.deepEqual(parsePayload("[1]"), {
    ok: false,
    reason: "The payload must be a JSON object, as GitHub sends it.",
  });
  assert.equal(parsePayload("{ action").ok, false);
});
