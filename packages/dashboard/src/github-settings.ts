import type { GitHubInstallation } from "./api/port";

export const installationSettingsUrl = ({
  installationId,
  accountLogin,
  accountType,
}: Pick<GitHubInstallation, "installationId" | "accountLogin" | "accountType">): string =>
  accountType === "Organization"
    ? `https://github.com/organizations/${accountLogin}/settings/installations/${installationId}`
    : `https://github.com/settings/installations/${installationId}`;
