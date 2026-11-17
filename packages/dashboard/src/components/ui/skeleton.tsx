import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Skeleton = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
);
