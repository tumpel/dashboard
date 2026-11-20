import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session, TriggerStartRefused } from "../src/api/port.ts";
import { parsePayload, runsOf } from "../src/triggers.ts";

const session = (sessionId: string, createdAt: number, startedBy: Session["startedBy"]): Session =>
  ({ sessionId, createdAt, startedBy }) as Session;

const refusal = (triggerId: string, deliveryId: string, createdAt: number): TriggerStartRefused => ({
  event: "TriggerStartRefused",
  eventId: createdAt,
  tenantId: "tnt_1",
  createdAt,
  triggerId,
  deliveryId,
  refusal: { code: "NoHostOnline", detail: "No host is online." },
});

test("runs merge the trigger's sessions and refusals, newest first, and skip every other start", () => {
  const sessions = [
    session("ses_old", 100, { kind: "Trigger", triggerId: "trg_1", deliveryId: "d1" }),
    session("ses_new", 300, { kind: "Trigger", triggerId: "trg_1", deliveryId: "d3" }),
    session("ses_other", 400, { kind: "Trigger", triggerId: "trg_2", deliveryId: "d4" }),
    session("ses_person", 500, { kind: "Person", principalId: "prn_1" }),
  ];
  const refusals = [refusal("trg_1", "d2", 200), refusal("trg_2", "d5", 600)];
  assert.deepEqual(
    runsOf("trg_1", sessions, refusals).map((run) => [run.kind, run.deliveryId]),
    [
      ["Session", "d3"],
      ["Refused", "d2"],
      ["Session", "d1"],
    ],
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
