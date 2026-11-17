import type { ReactNode } from "react";

export const PageHeader = ({ title, crumb, actions }: { title: string; crumb?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      {crumb !== undefined && <div className="text-[13px] text-muted-foreground">{crumb}</div>}
      <h1 tabIndex={-1} className="text-xl font-semibold tracking-tight">
        {title}
      </h1>
    </div>
    {actions !== undefined && <div className="flex gap-2">{actions}</div>}
  </div>
);
