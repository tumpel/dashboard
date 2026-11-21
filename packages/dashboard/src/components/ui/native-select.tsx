import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const NativeSelect = ({ className, ...props }: ComponentProps<"select">) => (
  <select
    className={cn(
      "flex h-9 w-full rounded-md border bg-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-destructive",
      className,
    )}
    {...props}
  />
);
