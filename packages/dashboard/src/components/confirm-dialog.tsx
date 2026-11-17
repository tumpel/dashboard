import type { ReactNode } from "react";
import { ProblemBlock } from "./problem-block";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./ui/dialog";

export interface ConfirmMutation {
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export const ConfirmDialog = ({
  open,
  onClose,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  destructive,
  confirmDisabled,
  mutation,
  refusalActions,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  destructive: boolean;
  confirmDisabled: boolean;
  mutation: ConfirmMutation | null;
  refusalActions: ReactNode;
  onConfirm: () => void;
}) => {
  const refusal = mutation?.error ?? null;
  const pending = mutation?.isPending ?? false;
  const close = () => {
    mutation?.reset();
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="grid gap-1">{description}</div>
        </DialogDescription>
        {refusal !== null && <ProblemBlock error={refusal} actions={refusalActions} />}
        <DialogFooter>
          <Button variant="outline" onClick={close} autoFocus>
            {refusal === null ? cancelLabel : "Close"}
          </Button>
          {refusal === null && (
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={confirmDisabled || pending}
              onClick={onConfirm}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
