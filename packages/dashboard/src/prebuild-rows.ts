import { PrebuildStateSchema } from "@tumpel/schemas";
import type { Prebuild } from "./api/port";

export const PREBUILD_STATES = PrebuildStateSchema.options;
export const repositoryName = (repository: string): string => repository.replace(/^https:\/\/github\.com\//, "");

export const standingFailure = (prebuilds: readonly Prebuild[]): Prebuild | undefined => {
  for (const prebuild of prebuilds) {
    if (prebuild.status.state === "Done") return undefined;
    if (prebuild.status.state === "Failed") return prebuild;
  }
  return undefined;
};

export const shortDigest = (digest: string): string => `sha256:${digest.slice(0, 12)}`;

export const formatBytes = (bytes: number): string => {
  const mib = bytes / 1024 ** 2;
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB`;
  return `${Math.max(1, Math.round(mib))} MiB`;
};

export const finishedAtOf = (prebuild: Prebuild): string | null =>
  prebuild.status.state === "Done" || prebuild.status.state === "Failed" ? prebuild.status.finishedAt : null;

const TRANSCRIPT_PATH = /^\/v1\/sessions\/([^/]+)\/transcript$/;

export const sessionIdOfLogUrl = (logUrl: string): string | undefined => {
  if (!URL.canParse(logUrl)) return undefined;
  const match = TRANSCRIPT_PATH.exec(new URL(logUrl).pathname);
  const sessionId = match?.[1];
  return sessionId === undefined ? undefined : decodeURIComponent(sessionId);
};
