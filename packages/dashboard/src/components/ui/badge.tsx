import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        success: "border-success/40 text-success",
        primary: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border text-muted-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        destructive: "border-destructive border-2 font-semibold text-destructive",
        grey: "border-transparent bg-muted-foreground text-background",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export const Badge = ({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
