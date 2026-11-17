import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Dialog = DialogPrimitive.Root;

export const DialogContent = ({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      className={cn(
        "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-6 shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        <XIcon className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DialogTitle = ({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("text-[17px] font-semibold", className)} {...props} />
);

export const DialogDescription = ({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
