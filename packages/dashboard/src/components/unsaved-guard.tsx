import { useBlocker } from "@tanstack/react-router";
import { type ReactNode, useRef } from "react";
import { ConfirmDialog } from "./confirm-dialog";

export const useUnsavedGuard = (dirty: boolean): { release: () => void; dialog: ReactNode } => {
  const released = useRef(false);
  const dirtyNow = useRef(dirty);
  dirtyNow.current = dirty;
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => dirtyNow.current && !released.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirtyNow.current && !released.current,
    withResolver: true,
  });
  const dialog = (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      onClose={() => blocker.reset?.()}
      title="Leave without saving?"
      description="Your edits on this page are not saved. Leaving discards them."
      cancelLabel="Keep editing"
      confirmLabel="Discard edits"
      pendingLabel="Discard edits"
      destructive
      confirmDisabled={false}
      mutation={null}
      refusalActions={null}
      onConfirm={() => blocker.proceed?.()}
    />
  );
  return {
    release: () => {
      released.current = true;
    },
    dialog,
  };
};
