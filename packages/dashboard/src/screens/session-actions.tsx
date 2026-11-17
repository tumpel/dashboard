import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast as notify } from "sonner";
import type { Session } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useTenantApi } from "../context";
import { keys } from "../queries";

export const STOPPABLE: ReadonlySet<Session["state"]> = new Set(["Starting", "Idle", "Running"]);

export type SessionAction = "stop" | "archive";

const SessionActionDialog = ({
  tenantId,
  open,
  onClose,
  title,
  body,
  actionLabel,
  pendingLabel,
  run,
  toast,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  actionLabel: string;
  pendingLabel: string;
  run: () => Promise<Session>;
  toast: string;
}) => {
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: run,
    onSuccess: (session) => {
      queryClient.setQueryData(keys.session(tenantId, session.sessionId), session);
      void queryClient.invalidateQueries({ queryKey: keys.sessions(tenantId), exact: true });
      notify(toast);
      action.reset();
      onClose();
    },
  });
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      cancelLabel="Cancel"
      confirmLabel={actionLabel}
      pendingLabel={pendingLabel}
      destructive
      confirmDisabled={false}
      mutation={action}
      refusalActions={null}
      onConfirm={() => action.mutate()}
    />
  );
};

export const SessionActionDialogs = ({
  tenantId,
  sessionId,
  action,
  onClose,
}: {
  tenantId: string;
  sessionId: string;
  action: SessionAction | null;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  return (
    <>
      <SessionActionDialog
        tenantId={tenantId}
        open={action === "stop"}
        onClose={onClose}
        title="Stop this session?"
        body={
          <>
            <p>Tumpel snapshots the session now, then removes its box.</p>
            <p>The next prompt boots a fresh box from that snapshot. A stopped session can be archived.</p>
          </>
        }
        actionLabel="Stop session"
        pendingLabel="Stopping..."
        run={() => api.stopSession(sessionId)}
        toast="Stopping. Tumpel takes the last snapshot, then removes the box."
      />
      <SessionActionDialog
        tenantId={tenantId}
        open={action === "archive"}
        onClose={onClose}
        title="Archive this session?"
        body={<p>Archiving deletes its snapshots. The transcript stays readable. It cannot be resumed.</p>}
        actionLabel="Archive"
        pendingLabel="Archiving..."
        run={() => api.archiveSession(sessionId)}
        toast="Archived. The transcript stays readable."
      />
    </>
  );
};
