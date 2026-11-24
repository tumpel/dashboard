import { MCP_PATH } from "@tumpel/api/constants";
import type { Host, Persona, ReportedHostUsage, SecretKey, Session } from "./api/port";

export const HOST_STATES = ["Online", "Offline", "Enrolled", "Revoked"] as const;
export const SESSION_STATES = ["Starting", "Idle", "Running", "Stopping", "Stopped", "Failed", "Archived"] as const;
export const activeHost = (hosts: readonly Host[]): Host | undefined => hosts.find((host) => host.state !== "Revoked");

export const OPEN_SESSION_STATES: ReadonlySet<Session["state"]> = new Set(["Starting", "Idle", "Running", "Stopping"]);

export const freeSlots = (usage: ReportedHostUsage): number => Math.max(0, usage.boxCapacity - usage.boxesRunning);

export const countBy = <T, K extends string>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> => {
  const counts = new Map<K, number>();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
};

export interface SlotTotals {
  capacity: number;
  running: number;
  free: number;
  reporting: number;
}

export const slotTotals = (usage: readonly ReportedHostUsage[]): SlotTotals =>
  usage.reduce<SlotTotals>(
    (totals, row) => ({
      capacity: totals.capacity + row.boxCapacity,
      running: totals.running + row.boxesRunning,
      free: totals.free + freeSlots(row),
      reporting: totals.reporting + 1,
    }),
    { capacity: 0, running: 0, free: 0, reporting: 0 },
  );

export const usageByHost = (usage: readonly ReportedHostUsage[]): Map<string, ReportedHostUsage> =>
  new Map(usage.map((row) => [row.hostId, row]));

export const hostName = (hosts: readonly Host[], hostId: string): string =>
  hosts.find((host) => host.hostId === hostId)?.name ?? hostId;

export const formatTime = (epochMs: number): string => {
  const date = new Date(epochMs);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
};

export const formatKib = (bytes: number): string => `${Math.ceil(bytes / 1024)} KiB`;

export const expiryDate = (expiresAt: string): string => expiresAt.slice(0, 10);

export const formatMib = (mib: number): string => `${mib.toLocaleString("en-GB").replace(/,/g, " ")} MiB`;

export const repositoryLabel = (repository: string): string =>
  repository.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");

export const personaName = (personas: readonly Persona[], personaId: string): string =>
  personas.find((persona) => persona.personaId === personaId)?.name ?? personaId;

export const HARNESS_NAMES: Record<Session["harness"], string> = {
  ClaudeCode: "Claude Code",
  Codex: "Codex",
  OpenCode: "OpenCode",
  PiDev: "Pi.dev",
  MistralAgent: "Mistral agent",
  Unrecognised: "Unrecognised",
};

export const SECRET_KIND_NAMES: Record<SecretKey["kind"], string> = {
  Variable: "Variable",
  ApiKey: "API key",
  SubscriptionToken: "Subscription token",
  CredentialFile: "Login file",
};

export const formatDate = (epochMs: number): string => formatTime(epochMs).slice(0, 10);

export const mcpUrl = (apiOrigin: string): string => `${apiOrigin}${MCP_PATH}`;
