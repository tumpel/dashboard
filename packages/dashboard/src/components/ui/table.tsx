import type { ComponentProps } from "react";
import { cn } from "../../lib";

export const Table = ({ className, ...props }: ComponentProps<"table">) => (
  <div className="w-full overflow-x-auto rounded-lg border bg-card">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);

export const TableHeader = (props: ComponentProps<"thead">) => <thead className="bg-muted" {...props} />;

export const TableBody = (props: ComponentProps<"tbody">) => <tbody {...props} />;

export const TableRow = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr className={cn("border-b last:border-0 hover:bg-accent/50", className)} {...props} />
);

export const TableHead = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    className={cn("h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={cn("px-3 py-2 align-middle", className)} {...props} />
);
