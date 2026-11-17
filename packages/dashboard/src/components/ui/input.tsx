import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input
    className={cn(
      "flex h-9 w-full rounded-md border bg-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive",
      className,
    )}
    {...props}
  />
);

const fieldClass =
  "w-full rounded-md border bg-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive disabled:opacity-60";

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
  <textarea className={cn(fieldClass, "min-h-24 py-2", className)} {...props} />
);

export const NativeSelect = ({ className, ...props }: ComponentProps<"select">) => (
  <select className={cn(fieldClass, "h-9 py-1", className)} {...props} />
);
