import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Host, ReportedHostUsage, Session } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { HostStateBadge } from "../components/status-badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  countBy,
  formatMib,
  formatTime,
  freeSlots,
  HOST_STATES,
  hostName,
  OPEN_SESSION_STATES,
  SESSION_STATES,
  slotTotals,
  usageByHost,
} from "../fleet";
import { useHosts, useHostUsage, useSessions } from "../queries";
import { MetricTiles } from "./metric-tiles";
import { ResumeSetup } from "./resume-setup";

const Tile = ({ label, children, busy }: { label: string; children: ReactNode; busy: boolean }) => (
  <Card aria-busy={busy} className="min-h-28">
    <CardContent className="grid gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      {children}
    </CardContent>
  </Card>
);

const TileSkeleton = () => (
  <>
    <Skeleton className="h-7 w-24" />
    <Skeleton className="h-4 w-40" />
  </>
);

const HostsTile = ({ tenantId, hosts }: { tenantId: string; hosts: Host[] }) => {
  const counts = countBy(hosts, (host) => host.state);
  const live = hosts.filter((host) => host.state !== "Revoked").length;
  return (
    <>
      <Link
        to="/t/$tenantId/hosts"
        params={{ tenantId }}
        search={{ state: ["Online"] }}
        className="text-2xl font-semibold hover:underline"
      >
        {counts.get("Online") ?? 0} of {live} up
      </Link>
      <span className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
        {HOST_STATES.map((state) => (
          <Link
            key={state}
            to="/t/$tenantId/hosts"
            params={{ tenantId }}
            search={{ state: [state] }}
            className="hover:underline"
          >
            {state} {counts.get(state) ?? 0}
          </Link>
        ))}
      </span>
    </>
  );
};

const SlotsTile = ({ tenantId, usage }: { tenantId: string; usage: ReportedHostUsage[] }) => {
  const totals = slotTotals(usage);
  return (
    <>
      <Link
        to="/t/$tenantId/hosts"
        params={{ tenantId }}
        search={{ state: [] }}
        className="text-2xl font-semibold hover:underline"
      >
        {totals.free} free
      </Link>
      <span className="text-[13px] text-muted-foreground">
        of {totals.capacity}, {totals.running} running, {totals.warm} warm
      </span>
      <span className="text-[13px] text-muted-foreground">over {totals.reporting} reporting hosts</span>
    </>
  );
};

const SessionsTile = ({ sessions }: { sessions: Session[] }) => {
  const counts = countBy(sessions, (session) => session.state);
  const open = sessions.filter((session) => OPEN_SESSION_STATES.has(session.state)).length;
  return (
    <>
      <span className="text-2xl font-semibold">{open} open</span>
      <span className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
        {SESSION_STATES.filter((state) => counts.has(state)).map((state) => (
          <span key={state}>
            {state} {counts.get(state)}
          </span>
        ))}
      </span>
    </>
  );
};

const HostSlotsTable = ({
  tenantId,
  hosts,
  usage,
}: {
  tenantId: string;
  hosts: Host[];
  usage: ReportedHostUsage[];
}) => {
  const byHost = usageByHost(usage);
  return (
    <Table mobile>
      <TableHeader>
        <TableRow>
          <TableHead>Host</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Slots cap / run / warm / free</TableHead>
          <TableHead>Load</TableHead>
          <TableHead>Mem free</TableHead>
          <TableHead>Last report</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hosts.map((host) => {
          const row = byHost.get(host.hostId);
          return (
            <TableRow key={host.hostId}>
              <TableCell mobile="primary">
                <Link
                  to="/t/$tenantId/hosts/$hostId"
                  params={{ tenantId, hostId: host.hostId }}
                  className="font-medium hover:underline"
                >
                  {host.name}
                </Link>
              </TableCell>
              <TableCell mobile="summary">
                <HostStateBadge state={host.state} />
              </TableCell>
              {row === undefined ? (
                <TableCell mobile="full" colSpan={4} className="text-muted-foreground">
                  {host.state === "Revoked" ? "" : "no report yet"}
                </TableCell>
              ) : (
                <>
                  <TableCell label="Slots cap / run / warm / free" className="font-mono text-[13px]">
                    {row.boxCapacity} / {row.boxesRunning} / {row.boxesWarm} / {freeSlots(row)}
                  </TableCell>
                  <TableCell label="Load">{row.loadAverage.toFixed(2)}</TableCell>
                  <TableCell label="Mem free">{formatMib(row.memoryAvailableMib)}</TableCell>
                  <TableCell label="Last report">{formatTime(row.updatedAt)}</TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const Breakdown = ({ title, counts }: { title: string; counts: Map<string, number> }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {counts.size === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet. Start one once a host is Online.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {[...counts].map(([name, count]) => (
            <li key={name} className="flex justify-between gap-2">
              <span className="font-mono text-[13px]">{name}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

export const OverviewScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/overview" });
  const hosts = useHosts(tenantId);
  const usage = useHostUsage(tenantId);
  const sessions = useSessions(tenantId);
  const header = (
    <>
      <PageHeader title="Overview" />
      <ResumeSetup tenantId={tenantId} />
    </>
  );
  if (hosts.data?.length === 0 && sessions.data?.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No hosts yet"
          detail="Enrol a Linux machine with KVM and sessions can run on it."
          action={
            <Button asChild>
              <Link to="/t/$tenantId/hosts" params={{ tenantId }} search={{ state: [] }} hash="enrol">
                Enrol a host
              </Link>
            </Button>
          }
        />
      </>
    );
  }
  return (
    <>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile label="Hosts" busy={hosts.isPending}>
          {hosts.isPending ? (
            <TileSkeleton />
          ) : hosts.isError ? (
            <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />
          ) : (
            <HostsTile tenantId={tenantId} hosts={hosts.data} />
          )}
        </Tile>
        <Tile label="Box slots" busy={usage.isPending}>
          {usage.isPending ? (
            <TileSkeleton />
          ) : usage.isError ? (
            <ProblemBlock error={usage.error} onRetry={() => void usage.refetch()} />
          ) : (
            <SlotsTile tenantId={tenantId} usage={usage.data} />
          )}
        </Tile>
        <Tile label="Sessions" busy={sessions.isPending}>
          {sessions.isPending ? (
            <TileSkeleton />
          ) : sessions.isError ? (
            <ProblemBlock error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : (
            <SessionsTile sessions={sessions.data} />
          )}
        </Tile>
      </div>
      <h2 className="mt-8 mb-3 text-[17px] font-semibold">Metrics</h2>
      <MetricTiles tenantId={tenantId} />
      <h2 className="mt-8 mb-3 text-[17px] font-semibold">Hosts and box slots</h2>
      {hosts.isPending || usage.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : hosts.isError ? (
        <ProblemBlock error={hosts.error} onRetry={() => void hosts.refetch()} />
      ) : (
        <HostSlotsTable tenantId={tenantId} hosts={hosts.data} usage={usage.data ?? []} />
      )}
      {sessions.isSuccess && (
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <Breakdown
            title="Sessions by host"
            counts={countBy(sessions.data, (session) => hostName(hosts.data ?? [], session.hostId))}
          />
          <Breakdown
            title="Sessions by harness"
            counts={countBy(sessions.data, (session) => `${session.harness} ${session.harnessVersion}`)}
          />
        </div>
      )}
    </>
  );
};
