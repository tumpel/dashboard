import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Sheet = DialogPrimitive.Root;

export const SheetContent = ({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
    <DialogPrimitive.Content
      className={cn(
        "fixed inset-y-0 right-0 z-50 grid w-full grid-rows-[auto_1fr] gap-3 border-l bg-card p-4 shadow-lg sm:max-w-xl",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute top-4 right-4 rounded-sm p-1 opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        <XIcon className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const SheetTitle = DialogPrimitive.Title;

export const SheetDescription = DialogPrimitive.Description;
