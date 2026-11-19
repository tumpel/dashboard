import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Popover = PopoverPrimitive.Root;

export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = ({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
);
