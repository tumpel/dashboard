import type { ReactNode } from "react";

export const EmptyState = ({ title, detail, action }: { title: string; detail: string; action: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-10 text-center">
    <img src="/logo128.png" alt="" width={48} height={48} />
    <h3 className="text-[17px] font-semibold">{title}</h3>
    <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
    {action}
  </div>
);
