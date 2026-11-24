import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import type { GitHubInstallation } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useTenantApi } from "../context";
import { installationSettingsUrl } from "../github-settings";
import { useHashDialog } from "../hash-dialog";
import { connectionKeys, keys } from "../queries";

export const fieldErrors = (error: z.ZodError): Map<string, string> =>
  new Map(error.issues.map((issue) => [String(issue.path[0]), issue.message]));

export const GitHubDisconnectDialog = ({
  tenantId,
  installations,
}: {
  tenantId: string;
  installations: GitHubInstallation[];
}) => {
  const api = useTenantApi(tenantId);
  const dialog = useHashDialog();
  const queryClient = useQueryClient();
  const installation = installations.find(({ installationId }) => dialog.isOpen(`disconnect-github-${installationId}`));
  const installationId = installation?.installationId ?? null;
  const disconnect = useMutation({
    mutationFn: (installation: number) => api.deleteGitHubConnection(installation),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list(tenantId) });
      void queryClient.invalidateQueries({ queryKey: keys.githubInstallations(tenantId) });
      toast("Installation disconnected. Uninstall the App on GitHub to remove it there.");
      disconnect.reset();
      dialog.close();
    },
  });
  return (
    <ConfirmDialog
      open={installation !== undefined}
      onClose={dialog.close}
      title={`Disconnect ${installation?.accountLogin ?? "GitHub"}?`}
      description={
        <>
          <p>
            Turns on repositories of {installation?.accountLogin ?? "this account"} stop getting installation tokens and
            fall back to the secret set's GITHUB_TOKEN. Other connected accounts stay.
          </p>
          <p className="font-semibold text-foreground">
            The App stays installed on GitHub. Uninstall it there to remove it:{" "}
            <a
              className="underline"
              href={installation === undefined ? undefined : installationSettingsUrl(installation)}
              target="_blank"
              rel="noreferrer"
            >
              open the installation on GitHub
            </a>
            .
          </p>
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Disconnect"
      pendingLabel="Disconnecting..."
      destructive
      confirmDisabled={installationId === null}
      mutation={disconnect}
      refusalActions={null}
      onConfirm={() => {
        if (installationId !== null) disconnect.mutate(installationId);
      }}
    />
  );
};
