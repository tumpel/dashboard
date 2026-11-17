import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NamespaceConnectionStartSchema } from "@tumpel/schemas";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import type { GitHubInstallation } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { CopyValues } from "../components/copy-value";
import { Field } from "../components/field";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { installationSettingsUrl } from "../github-settings";
import { useHashDialog } from "../hash-dialog";
import { connectionKeys, keys, useNamespaceConnection } from "../queries";

export type ConnectionHash = "connect-namespace" | `disconnect-github-${number}` | "disconnect-namespace";

export const useRefreshConnections = (tenantId: string) => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: connectionKeys.list(tenantId) });
    void queryClient.invalidateQueries({ queryKey: keys.githubInstallations(tenantId) });
  };
};

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
  const refresh = useRefreshConnections(tenantId);
  const installation = installations.find(({ installationId }) => dialog.isOpen(`disconnect-github-${installationId}`));
  const installationId = installation?.installationId ?? null;
  const disconnect = useMutation({
    mutationFn: (installation: number) => api.deleteGitHubConnection(installation),
    onSuccess: () => {
      refresh();
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

export const NamespaceConnectDialog = ({ tenantId }: { tenantId: string }) => {
  const api = useTenantApi(tenantId);
  const dialog = useHashDialog();
  const refresh = useRefreshConnections(tenantId);
  const detail = useNamespaceConnection(tenantId);
  const [workspaceId, setWorkspaceId] = useState("");
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const connect = useMutation({
    mutationFn: (body: z.infer<typeof NamespaceConnectionStartSchema>) => api.startNamespaceConnection(body),
    onSuccess: (_, body) => {
      refresh();
      toast(`Namespace connected. It bills workspace ${body.accountLabel}.`);
      dismiss();
    },
  });
  const dismiss = () => {
    connect.reset();
    setErrors(new Map());
    dialog.close();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = NamespaceConnectionStartSchema.safeParse({
      accountLabel: accountLabel ?? workspaceId,
      workspaceId,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors(new Map());
    connect.mutate(parsed.data);
  };
  const trust = () => {
    if (detail.isPending) return <Skeleton className="h-24 w-full" />;
    if (detail.isError) return <ProblemBlock error={detail.error} onRetry={() => void detail.refetch()} />;
    const link = detail.data.link;
    if (link.state === "NotConfigured") {
      return (
        <ProblemCard wording={{ title: "Namespace cannot trust this stage yet", detail: link.detail, fix: link.fix }} />
      );
    }
    const trusted = link.state === "Connected" ? link.connection : link;
    return (
      <div className="rounded-md border p-3">
        <CopyValues
          values={[
            { name: "Issuer", value: trusted.issuer },
            { name: "Subject", value: trusted.subjectPattern },
            { name: "Audience", value: trusted.audience },
          ]}
        />
      </div>
    );
  };
  const workspaceError = errors.get("workspaceId") ?? null;
  const accountError = errors.get("accountLabel") ?? null;
  return (
    <Dialog open={dialog.isOpen("connect-namespace")} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-2xl">
        <form className="grid gap-4" onSubmit={submit}>
          <DialogTitle>Connect Namespace</DialogTitle>
          <DialogDescription asChild>
            <ol className="grid list-decimal gap-1 pl-5">
              <li>Ask Namespace Support to register Tumpel's issuer, once per workspace.</li>
              <li>Add this trust rule to your workspace.</li>
              <li>Give the workspace id and connect.</li>
            </ol>
          </DialogDescription>
          {trust()}
          <Field
            id="namespace-workspace"
            label="Namespace workspace id"
            error={workspaceError}
            hint="The id Namespace shows for the workspace, such as tenant_abc123. Its workload tokens may upload prebuild layers."
          >
            <Input
              id="namespace-workspace"
              value={workspaceId}
              aria-invalid={workspaceError !== null}
              onChange={(event) => setWorkspaceId(event.target.value)}
            />
          </Field>
          <Field
            id="namespace-account"
            label="Billing account"
            error={accountError}
            hint="The workspace that bills the builds, as you want it shown."
          >
            <Input
              id="namespace-account"
              value={accountLabel ?? workspaceId}
              aria-invalid={accountError !== null}
              onChange={(event) => setAccountLabel(event.target.value)}
            />
          </Field>
          {connect.isError && <ProblemBlock error={connect.error} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DISCONNECT = {
  name: "Namespace",
  effect: "New prebuilds stop running on Namespace. Stored prebuild layers stay and boxes keep using them.",
  providerStep: "Also remove the trust rule in your Namespace workspace.",
};

export const NamespaceDisconnectDialog = ({ tenantId }: { tenantId: string }) => {
  const api = useTenantApi(tenantId);
  const copy = DISCONNECT;
  const dialog = useHashDialog();
  const refresh = useRefreshConnections(tenantId);
  const disconnect = useMutation({
    mutationFn: () => api.deleteNamespaceConnection(),
    onSuccess: () => {
      refresh();
      toast(`${copy.name} disconnected. ${copy.providerStep}`);
      disconnect.reset();
      dialog.close();
    },
  });
  return (
    <ConfirmDialog
      open={dialog.isOpen("disconnect-namespace")}
      onClose={dialog.close}
      title={`Disconnect ${copy.name}?`}
      description={
        <>
          <p>{copy.effect}</p>
          <p className="font-semibold text-foreground">{copy.providerStep}</p>
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Disconnect"
      pendingLabel="Disconnecting..."
      destructive
      confirmDisabled={false}
      mutation={disconnect}
      refusalActions={null}
      onConfirm={() => disconnect.mutate()}
    />
  );
};
