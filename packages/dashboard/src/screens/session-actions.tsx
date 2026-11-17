import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast as notify } from "sonner";
import { type ApiFailure, failureOf, refusedAlone, type Session } from "../api/port";
import { wordingOf } from "../api/wording";
import { ConfirmDialog } from "../components/confirm-dialog";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { useTenantApi } from "../context";
import { repositoryLabel } from "../fleet";
import { keys } from "../queries";

export const STOPPABLE: ReadonlySet<Session["state"]> = new Set(["Starting", "Idle", "Running"]);
export const ARCHIVABLE: ReadonlySet<Session["state"]> = new Set(["Idle", "Stopped", "Failed"]);

export type SessionAction = "stop" | "cancel" | "archive";

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
        open={action === "cancel"}
        onClose={onClose}
        title="Cancel the running turn?"
        body={
          <>
            <p>The turn stops at once and fails as cancelled. Tumpel snapshots what the box holds, then removes it.</p>
            <p>The next prompt boots a fresh box from that snapshot.</p>
          </>
        }
        actionLabel="Cancel turn"
        pendingLabel="Cancelling..."
        run={() => api.cancelTurn(sessionId)}
        toast="Cancelled. Tumpel takes the last snapshot, then removes the box."
      />
      <SessionActionDialog
        tenantId={tenantId}
        open={action === "archive"}
        onClose={onClose}
        title="Archive this session?"
        body={
          <p>
            Archiving removes its box and deletes its snapshots. The transcript stays readable. It cannot be resumed.
          </p>
        }
        actionLabel="Archive"
        pendingLabel="Archiving..."
        run={() => api.archiveSession(sessionId)}
        toast="Archived. The transcript stays readable."
      />
    </>
  );
};

export const ArchiveSessionsDialog = ({
  tenantId,
  sessions: chosen,
  onClose,
  onArchived,
}: {
  tenantId: string;
  sessions: Session[];
  onClose: () => void;
  onArchived: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const [sessions] = useState(chosen);
  const run = useMutation({
    mutationFn: async (): Promise<{ session: Session; failure: ApiFailure }[]> => {
      const settled = await Promise.allSettled(sessions.map((session) => api.archiveSession(session.sessionId)));
      const fault = settled.find((outcome) => outcome.status === "rejected" && !refusedAlone(outcome.reason));
      if (fault?.status === "rejected") throw fault.reason;
      return settled.flatMap((outcome, index) => {
        const session = sessions[index];
        if (outcome.status === "fulfilled" || session === undefined || !refusedAlone(outcome.reason)) return [];
        return [{ session, failure: outcome.reason }];
      });
    },
    onSuccess: (refused) => {
      void queryClient.invalidateQueries({ queryKey: keys.sessions(tenantId), exact: true });
      onArchived();
      if (refused.length > 0) return;
      notify(`Archived ${sessions.length} sessions. The transcripts stay readable.`);
      onClose();
    },
  });
  const refused = run.data ?? [];
  const finished = run.error !== null || refused.length > 0;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>Archive {sessions.length} sessions?</DialogTitle>
        <DialogDescription asChild>
          <div className="grid gap-1">
            <p>Archiving removes each box and deletes the snapshots.</p>
            <p>The transcripts stay readable. Archived sessions cannot be resumed.</p>
          </div>
        </DialogDescription>
        {run.error !== null && <ProblemBlock error={run.error} />}
        {refused.length > 0 && (
          <div role="alert" className="grid gap-2 rounded-lg border-2 border-destructive bg-card p-4 text-sm">
            <p className="font-semibold">
              {refused.length} of {sessions.length} sessions were not archived
            </p>
            <ul className="grid gap-1">
              {refused.map(({ session, failure }) => {
                const wording = wordingOf(failureOf(failure));
                return (
                  <li key={session.sessionId}>
                    <span className="font-medium">{repositoryLabel(session.repository)}</span>: {wording.detail}.{" "}
                    {wording.fix}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} autoFocus>
            {finished ? "Close" : "Cancel"}
          </Button>
          {!finished && (
            <Button variant="destructive" disabled={run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? "Archiving..." : `Archive ${sessions.length}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
