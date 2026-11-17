import type { ReactNode } from "react";

export const Field = ({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  hint: string | null;
  children: ReactNode;
}) => (
  <div className="grid gap-1 text-sm">
    <label htmlFor={id} className="font-medium">
      {label}
    </label>
    {children}
    {error !== null && (
      <p id={`${id}-error`} className="text-xs font-semibold text-destructive">
        {error}
      </p>
    )}
    {error === null && hint !== null && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);
