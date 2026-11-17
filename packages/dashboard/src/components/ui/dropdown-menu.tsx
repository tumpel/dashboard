import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuContent = ({ className, ...props }: ComponentProps<typeof MenuPrimitive.Content>) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      sideOffset={4}
      className={cn("z-50 min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md", className)}
      {...props}
    />
  </MenuPrimitive.Portal>
);

export const DropdownMenuLabel = ({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) => (
  <MenuPrimitive.Label
    className={cn("px-2 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase", className)}
    {...props}
  />
);

export const DropdownMenuItem = ({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) => (
  <MenuPrimitive.Item
    className={cn(
      "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:opacity-50",
      className,
    )}
    {...props}
  />
);

export const DropdownMenuSeparator = (props: ComponentProps<typeof MenuPrimitive.Separator>) => (
  <MenuPrimitive.Separator className="my-1 h-px bg-border" {...props} />
);
