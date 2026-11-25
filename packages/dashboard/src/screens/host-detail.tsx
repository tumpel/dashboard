import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import type { Host, ReportedHostUsage } from "../api/port";
import { UNRECOGNISED_LABEL } from "../api/wording";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { HostStateBadge } from "../components/status-badge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { formatMib, formatTime, freeSlots } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { EMPTY_SEARCH } from "../metrics-search";
import { keys, useHost, useHostUsage } from "../queries";

const GIB = 1024 ** 3;

const Facts = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
    {rows.map(([term, value]) => (
      <div key={term} className="contents">
        <dt className="text-muted-foreground">{term}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

const UsagePanel = ({ host, usage }: { host: Host; usage: ReportedHostUsage | undefined }) => {
  if (host.state === "Revoked") return <p className="text-sm text-muted-foreground">Revoked hosts report nothing.</p>;
  if (usage === undefined) {
    return (
      <div className="grid gap-1 text-sm">
        <p className="font-semibold">No report yet.</p>
        <p>The supervisor has not connected since it enrolled.</p>
        <p className="text-muted-foreground">Check that the service runs on the machine.</p>
      </div>
    );
  }
  const slots: [string, number][] = [
    ["Capacity", usage.boxCapacity],
    ["Running", usage.boxesRunning],
    ["Free", freeSlots(usage)],
  ];
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        {slots.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-muted p-2 text-center">
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <Facts
        rows={[
          ["Load average", usage.loadAverage.toFixed(2)],
          ["Memory free", formatMib(usage.memoryAvailableMib)],
          ["Last report", formatTime(usage.updatedAt)],
        ]}
      />
      <p className="text-xs text-muted-foreground">Refreshes on window focus and after each action.</p>
    </div>
  );
};

type UpdateStep = Extract<Host["supervisorUpdateStep"], { state: "Reported" }>["step"];
type UpdateFailure = Extract<Host["supervisorUpdateFailure"], { state: "Reported" }>["failure"];

const shortSha = (sha256: string): string => sha256.slice(0, 12);

const STEP_WORDS: Record<UpdateStep["phase"], (step: UpdateStep) => string> = {
  Unrecognised: () => UNRECOGNISED_LABEL,
  Fetching: (step) => `Downloading supervisor ${shortSha(step.toSha256)}.`,
  DryRunning: (step) =>
    `Test-running supervisor ${shortSha(step.toSha256)} beside the running one. Once it passes, it takes over when no box runs.`,
  Staged: (step) => `Update to ${step.releaseVersion} staged, waiting for ${step.boxesRunning} boxes.`,
  WaitingForIdle: (step) =>
    `Supervisor ${shortSha(step.toSha256)} passed its test run. It takes over once no box runs.`,
  Restarting: (step) => `Restarting on supervisor ${shortSha(step.toSha256)}.`,
  Online: (step) => `Runs supervisor ${shortSha(step.toSha256)} since ${formatTime(Date.parse(step.at))}.`,
};

const FAILURE_WORDS: Record<UpdateFailure["reason"], string> = {
  Unrecognised: UNRECOGNISED_LABEL,
  SupervisorUpdateFetchFailed: "The download failed. The running supervisor stays.",
  SupervisorUpdateChecksumMismatch: "The download did not match the release checksum. The running supervisor stays.",
  SupervisorUpdateDryRunFailed: "The new supervisor failed its test run. The running supervisor stays.",
  SupervisorUpdateStateUnreadable: "The host's update state file is unreadable. Updates stop until it is deleted.",
  SupervisorUpdateIdleTimedOut: "The host kept running boxes, so the switch waits for a quiet moment.",
  SupervisorUpdateSwapFailed: "Switching binaries failed. The running supervisor stays.",
  SupervisorUpdateRolledBack: "The new supervisor did not come online, so the one before it runs again.",
};

const UpdatePanel = ({ host }: { host: Host }) => {
  const step = host.supervisorUpdateStep;
  const failure = host.supervisorUpdateFailure;
  if (step.state === "NotReported" && failure.state === "NotReported") {
    return <p className="text-sm text-muted-foreground">No update reported yet.</p>;
  }
  return (
    <div className="grid gap-3 text-sm">
      {step.state === "Reported" ? <p>{STEP_WORDS[step.step.phase](step.step)}</p> : null}
      {failure.state === "Reported" ? (
        <div className="grid gap-1">
          <p className="font-semibold">
            Last failure, {formatTime(Date.parse(failure.failure.failedAt))}: {FAILURE_WORDS[failure.failure.reason]}
          </p>
          <p className="text-muted-foreground">{failure.failure.detail}</p>
          {failure.failure.outputTail.length === 0 ? null : (
            <pre className="overflow-x-auto rounded-md border bg-muted p-2 text-xs">
              {failure.failure.outputTail.join("\n")}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
};

const RevokeHostDialog = ({ tenantId, host }: { tenantId: string; host: Host }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const dialog = useHashDialog();
  const [typed, setTyped] = useState("");
  const confirmId = useId();
  const close = () => {
    setTyped("");
    dialog.close();
  };
  const revoke = useMutation({
    mutationFn: () => api.revokeHost(host.hostId),
    onSuccess: (revoked) => {
      queryClient.setQueryData(keys.host(tenantId, host.hostId), revoked);
      void queryClient.invalidateQueries({ queryKey: keys.hosts(tenantId) });
      toast(`${host.name} revoked. Its connection is closed.`);
      close();
    },
  });
  return (
    <ConfirmDialog
      open={dialog.isOpen("revoke")}
      onClose={close}
      title={`Revoke ${host.name}?`}
      description={
        <>
          <p>Its connection closes at once and its running turns fail.</p>
          <p>Its sessions take their next turn on another Online host.</p>
          <p>The machine must enrol again with a new token.</p>
          <label htmlFor={confirmId} className="mt-2 text-foreground">
            Type <span className="font-mono">{host.name}</span> to confirm
          </label>
          <Input id={confirmId} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Revoke host"
      pendingLabel="Revoking..."
      destructive
      confirmDisabled={typed !== host.name}
      mutation={revoke}
      refusalActions={null}
      onConfirm={() => revoke.mutate()}
    />
  );
};

export const HostDetailScreen = () => {
  const { tenantId, hostId } = useParams({ from: "/t/$tenantId/hosts/$hostId" });
  const host = useHost(tenantId, hostId);
  const usage = useHostUsage(tenantId);
  const crumb = (
    <Link to="/t/$tenantId/hosts" params={{ tenantId }} search={{ state: [] }} className="hover:underline">
      Hosts /
    </Link>
  );
  if (host.isPending) {
    return (
      <>
        <PageHeader title="Host" crumb={crumb} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  if (host.isError) {
    return (
      <>
        <PageHeader title="Host" crumb={crumb} />
        <ProblemBlock error={host.error} onRetry={() => void host.refetch()} />
      </>
    );
  }
  const data = host.data;
  const hostUsage = usage.data?.find((row) => row.hostId === hostId);
  return (
    <>
      <PageHeader
        title={data.name}
        crumb={crumb}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/t/$tenantId/metrics/hosts/$hostId" params={{ tenantId, hostId }} search={EMPTY_SEARCH}>
                Open metrics
              </Link>
            </Button>
            {data.state !== "Revoked" && (
              <Button variant="destructive" asChild>
                <Link to="." hash="revoke">
                  Revoke host
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Host</CardTitle>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                [
                  "State",
                  <span key="state" className="flex items-center gap-2">
                    <HostStateBadge state={data.state} />
                    <span className="font-mono text-[13px] text-muted-foreground">{data.supervisorVersion}</span>
                  </span>,
                ],
                ["Architecture", data.architecture],
                ["CPUs", data.cpuCount],
                ["Memory", `${Math.round(data.memoryBytes / GIB)} GiB`],
                ["Enrolled", formatTime(data.createdAt)],
                [
                  "Host id",
                  <span key="id" className="font-mono text-[13px]">
                    {data.hostId}
                  </span>,
                ],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : usage.isError ? (
              <ProblemBlock error={usage.error} onRetry={() => void usage.refetch()} />
            ) : (
              <UsagePanel host={data} usage={hostUsage} />
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Supervisor updates</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdatePanel host={data} />
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Labels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {data.labels.length === 0 ? (
            <span className="text-sm text-muted-foreground">No labels.</span>
          ) : (
            data.labels.map((label) => <Badge key={label}>{label}</Badge>)
          )}
        </CardContent>
      </Card>
      <RevokeHostDialog tenantId={tenantId} host={data} />
    </>
  );
};
