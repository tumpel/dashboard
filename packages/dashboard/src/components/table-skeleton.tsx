import { Skeleton } from "./ui/skeleton";

export const TableSkeleton = ({ rows }: { rows: number }) => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-3">
    {Array.from({ length: rows }, (_, row) => `row-${row}`).map((key) => (
      <Skeleton key={key} className="h-7 w-full" />
    ))}
  </div>
);
