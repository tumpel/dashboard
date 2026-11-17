import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Card = ({ className, ...props }: ComponentProps<"section">) => (
  <section className={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)} {...props} />
);

export const CardHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex items-center justify-between gap-2 px-4 pt-4", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: ComponentProps<"h2">) => (
  <h2 className={cn("text-[17px] leading-snug font-semibold", className)} {...props} />
);

export const CardContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("p-4", className)} {...props} />
);
