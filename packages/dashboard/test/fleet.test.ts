import assert from "node:assert/strict";
import { test } from "node:test";
import { MCP_PATH } from "@tumpel/api/constants";
import type { Host, ReportedHostUsage } from "../src/api/port.ts";
import { activeHost, freeSlots, mcpUrl } from "../src/fleet.ts";

const host = (hostId: string, state: Host["state"]): Host => ({
  hostId,
  tenantId: "tnt_a",
  name: hostId,
  state,
  ...(state === "Online" ? { presence: "Online", heardAt: "2026-11-15T13:00:00Z" } : { presence: "Offline" }),
  health: "Healthy",
  reportedHealth: "Healthy",
  architecture: "Amd64",
  cpuCount: 4,
  memoryBytes: 8 * 1024 ** 3,
  publicKey: "key",
  supervisorVersion: "0.9.2",
  labels: [],
  supervisorUpdateStep: { state: "NotReported" },
  supervisorUpdateFailure: { state: "NotReported" },
  channelProtocol: { state: "NotReported" },
  guestProtocol: { state: "NotReported" },
  createdAt: 0,
  updatedAt: 0,
});

test("an enrolled host that is down still completes the host step", () => {
  assert.equal(activeHost([host("hst_down", "Offline")])?.hostId, "hst_down");
  assert.equal(activeHost([host("hst_new", "Enrolled")])?.hostId, "hst_new");
});

test("only revoked hosts leave the host step open", () => {
  assert.equal(activeHost([host("hst_gone", "Revoked")]), undefined);
  assert.equal(activeHost([]), undefined);
});

test("running boxes occupy slots on a reporting host", () => {
  const usage: ReportedHostUsage = {
    hostId: "hst_a",
    tenantId: "tnt_a",
    boxCapacity: 4,
    boxesRunning: 2,
    loadAverage: 1,
    memoryAvailableMib: 4096,
    diskBudgetMib: 32_768,
    diskHeldMib: 16_384,
    memoryBudgetMib: 8192,
    memoryHeldMib: 4096,
    reportedHealth: "Healthy",
    channelProtocol: 18,
    createdAt: 0,
    updatedAt: 0,
  };
  assert.equal(freeSlots(usage), 2);
});

test("the connector URL is the API origin plus the MCP path", () => {
  assert.equal(mcpUrl("https://api.example.com"), `https://api.example.com${MCP_PATH}`);
  assert.equal(mcpUrl("https://api.other.example.com"), `https://api.other.example.com${MCP_PATH}`);
});
