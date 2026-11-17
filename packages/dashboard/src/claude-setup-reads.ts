import type { ClaudeSetup } from "./api/port";

export const LIVE_READ_MS = 1000;

const isLive = (setup: ClaudeSetup): boolean =>
  setup.status.state === "Starting" || setup.status.state === "AwaitingCode" || setup.status.state === "Minting";

export const nextSetupReadIn = (state: { status: string; data: ClaudeSetup | undefined }): number | false => {
  if (state.status === "error" || state.data === undefined) return false;
  return isLive(state.data) ? LIVE_READ_MS : false;
};
