import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { XIcon } from "lucide-react";
import { useMemo } from "react";
import type { Host, ReportedHostUsage } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { HostStateBadge } from "../components/status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatTime, freeSlots, HOST_STATES, usageByHost } from "../fleet";
import { cn } from "../lib";
import { useHosts, useHostUsage } from "../queries";
import { EnrolHostDialog } from "./enrol-host";

interface HostRow {
  host: Host;
  usage: ReportedHostUsage | undefined;
}

const column = createColumnHelper<HostRow>();

const columnsFor = (tenantId: string, usageFailed: boolean) => [
  column.display({
    id: "name",
    header: "Host",
    cell: ({ row }) => (
      <Link
        to="/t/$tenantId/hosts/$hostId"
        params={{ tenantId, hostId: row.original.host.hostId }}
        className="font-medium hover:underline"
      >
        {row.original.host.name}
      </Link>
    ),
  }),
  column.display({
    id: "state",
    header: "State",
    cell: ({ row }) => <HostStateBadge state={row.original.host.state} />,
  }),
  column.display({
    id: "version",
    header: "Version",
    cell: ({ row }) => <span className="font-mono text-[13px]">{row.original.host.supervisorVersion}</span>,
  }),
  column.display({
    id: "labels",
    header: "Labels",
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.host.labels.map((label) => (
          <Badge key={label}>{label}</Badge>
        ))}
      </span>
    ),
  }),
  column.display({
    id: "free",
    header: "Free slots",
    cell: ({ row }) => {
      if (row.original.host.state === "Revoked") return null;
      if (usageFailed) return <span className="text-muted-foreground">usage unavailable</span>;
      const usage = row.original.usage;
      if (usage === undefined) return <span className="text-muted-foreground">no report yet</span>;
      return `${freeSlots(usage)} of ${usage.boxCapacity}`;
    },
  }),
  column.display({
    id: "report",
    header: "Last report",
    cell: ({ row }) => (row.original.usage === undefined ? "" : formatTime(row.original.usage.updatedAt)),
  }),
];

const HostTable = ({ tenantId, rows, usageFailed }: { tenantId: string; rows: HostRow[]; usageFailed: boolean }) => {
  const columns = useMemo(() => columnsFor(tenantId, usageFailed), [tenantId, usageFailed]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.original.host.hostId}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const TableSkeleton = () => (
  <div aria-busy className="grid gap-2 rounded-lg border bg-card p-3">
    {[0, 1, 2, 3, 4].map((row) => (
      <Skeleton key={row} className="h-7 w-full" />
    ))}
  </div>
);

export const HostsListScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/hosts" });
  const { state: chosen } = useSearch({ from: "/t/$tenantId/hosts" });
  const navigate = useNavigate({ from: "/t/$tenantId/hosts" });
  const hosts = useHosts(tenantId);
  const usage = useHostUsage(tenantId);
  const toggle = (state: Host["state"]) =>
    void navigate({
      search: { state: chosen.includes(state) ? chosen.filter((item) => item !== state) : [...chosen, state] },
    });
  const enrol = (
    <Button asChild>
      <Link to="." hash="enrol">
        Enrol a host
      </Link>
    </Button>
  );
  const body = () => {
    if (hosts.isPending) return <TableSkeleton />;
    if (hosts.isError) return <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />;
    if (hosts.data.length === 0) {
      return (
        <EmptyState
          title="No hosts yet"
          detail="A host is a Linux machine with KVM. Enrol one with a single command."
          action={enrol}
        />
      );
    }
    const byHost = usageByHost(usage.data ?? []);
    const rows = hosts.data
      .filter((host) => chosen.length === 0 || chosen.includes(host.state))
      .map((host) => ({ host, usage: byHost.get(host.hostId) }));
    if (rows.length === 0) {
      return (
        <div className="grid justify-items-start gap-2 rounded-lg border bg-card p-6">
          <p className="font-medium">No {chosen.join(" or ")} hosts</p>
          <Button variant="outline" size="sm" onClick={() => void navigate({ search: { state: [] } })}>
            Clear filter
          </Button>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {usage.isError && <ProblemBlock error={usage.error} onRetry={() => void usage.refetch()} />}
        <HostTable tenantId={tenantId} rows={rows} usageFailed={usage.isError} />
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Hosts" actions={enrol} />
      <fieldset className="mb-4 flex flex-wrap gap-2">
        <legend className="sr-only">Filter by state</legend>
        {HOST_STATES.map((state) => {
          const on = chosen.includes(state);
          return (
            <button
              key={state}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(state)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {state}
              {on && <XIcon className="size-3" aria-hidden />}
            </button>
          );
        })}
      </fieldset>
      {body()}
      <EnrolHostDialog tenantId={tenantId} />
    </>
  );
};
