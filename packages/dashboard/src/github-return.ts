import { GitHubInstallRefusalSchema } from "@tumpel/schemas";
import { z } from "zod";

export type GitHubInstallRefusal = z.infer<typeof GitHubInstallRefusalSchema>;

export type GitHubReturn =
  | { kind: "None" }
  | { kind: "Refused"; reason: GitHubInstallRefusal; account: string }
  | { kind: "Failed"; detail: string };

const optionalList = z.array(z.string()).optional().catch(undefined);

export const gitHubReturnSearch = { refused: optionalList, account: optionalList, failed: optionalList };

export interface GitHubReturnQuery {
  from?: string[];
  refused?: string[];
  account?: string[];
  failed?: string[];
}

export const gitHubReturnOf = (query: GitHubReturnQuery): GitHubReturn => {
  if (!(query.from ?? []).includes("github")) return { kind: "None" };
  const failed = query.failed?.[0];
  if (failed !== undefined) return { kind: "Failed", detail: failed };
  const reason = GitHubInstallRefusalSchema.safeParse(query.refused?.[0]);
  if (reason.success) return { kind: "Refused", reason: reason.data, account: query.account?.[0] ?? "the account" };
  return { kind: "None" };
};

export const gitHubReturnUrl = (path: string): string => `${window.location.origin}${path}`;

export const refusalWording = (reason: GitHubInstallRefusal, login: string): { detail: string; fix: string } => {
  if (reason === "OtherTenant") {
    return {
      detail: `Another Tumpel tenant holds the installation on ${login}.`,
      fix: "Disconnect it in that tenant, then choose Add new here.",
    };
  }
  if (reason === "NotInstaller") {
    return {
      detail: `Someone else installed Tumpel on ${login}, and only they link it.`,
      fix: "Ask them to choose Add new in their own Tumpel session, or uninstall the App on GitHub and install it again yourself.",
    };
  }
  return {
    detail: `GitHub has not said who installed Tumpel on ${login}.`,
    fix: "Choose Add new again in a moment. If it stays, uninstall the App on GitHub and install it again.",
  };
};
