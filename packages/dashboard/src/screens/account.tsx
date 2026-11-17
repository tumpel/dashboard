import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import type { Device } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { RoleBadge } from "../components/role-badge";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useDashboard, useTenantApi } from "../context";
import { formatDate, formatTime, mcpUrl } from "../fleet";
import { memberKeys, useDevices, useWhoami } from "../queries";
import { CONNECTORS_URL } from "./setup/claude-step";
import { CopyBlock } from "./setup/parts";

const RevokeDeviceDialog = ({
  tenantId,
  device,
  onClose,
}: {
  tenantId: string;
  device: Device;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => api.revokeDevice(device.deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.devices(tenantId) });
      toast(`${device.name} signed out.`);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Sign out ${device.name}?`}
      description="Its token stops working at once. Sign in on that device again with tumpel login to use it."
      cancelLabel="Cancel"
      confirmLabel="Revoke"
      pendingLabel="Revoking..."
      destructive
      confirmDisabled={false}
      mutation={revoke}
      refusalActions={null}
      onConfirm={() => revoke.mutate()}
    />
  );
};

const DeviceRows = ({ devices, onRevoke }: { devices: Device[]; onRevoke: (device: Device) => void }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Device</TableHead>
        <TableHead>Signed in</TableHead>
        <TableHead>Last used</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {devices.map((device) => (
        <TableRow key={device.deviceId}>
          <TableCell className="font-medium">{device.name}</TableCell>
          <TableCell>{formatDate(device.createdAt)}</TableCell>
          <TableCell>{formatTime(device.lastUsedAt)}</TableCell>
          <TableCell className="text-right">
            <Button size="sm" variant="outline" onClick={() => onRevoke(device)}>
              Revoke
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const InstallCli = () => {
  const { ports } = useDashboard();
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        To add a Linux machine, paste this command in its terminal. It installs tumpel and shows the command that signs
        it in.
      </p>
      <CopyBlock
        text={`curl -fsSL ${ports.apiOrigin}/v1/releases/install.sh | sh`}
        label="Copy command"
        noun="command"
      />
    </div>
  );
};

const McpServer = () => {
  const { ports } = useDashboard();
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        Add this URL as a custom MCP connector in your chat app. It signs in through Tumpel; leave any client ID and
        secret empty.
      </p>
      <CopyBlock text={mcpUrl(ports.apiOrigin)} label="Copy URL" noun="URL" />
      <ul className="grid list-disc gap-1 pl-5 text-sm">
        <li>
          claude.ai: open{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={CONNECTORS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Settings, then Connectors
          </a>
          , and choose Add custom connector. On Team and Enterprise plans an owner adds it for the organization.
        </li>
        <li>Mistral Le Chat: open Connectors, then Add connector, then Custom MCP connector.</li>
      </ul>
    </div>
  );
};

export const AccountScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/account" });
  const whoami = useWhoami(tenantId);
  const devices = useDevices(tenantId);
  const [revoking, setRevoking] = useState<Device | null>(null);

  const principal = () => {
    if (whoami.isPending) return <Skeleton className="h-24 w-full" />;
    if (whoami.isError) return <ProblemBlock error={whoami.error} onRetry={() => void whoami.refetch()} />;
    return (
      <div className="grid gap-1 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{whoami.data.principal.email}</span>
          <RoleBadge role={whoami.data.principal.role} />
        </div>
        <span className="text-sm">{whoami.data.tenant.name}</span>
        <span className="font-mono text-xs text-muted-foreground">Principal {whoami.data.principal.principalId}</span>
      </div>
    );
  };

  const deviceList = () => {
    if (devices.isPending) return <TableSkeleton rows={2} />;
    if (devices.isError) return <ProblemBlock error={devices.error} onRetry={() => void devices.refetch()} />;
    if (devices.data.length === 0) {
      return <p className="text-sm text-muted-foreground">No device is signed in as you. tumpel login signs one in.</p>;
    }
    return <DeviceRows devices={devices.data} onRevoke={setRevoking} />;
  };

  return (
    <>
      <PageHeader title="Account" />
      <div className="grid gap-6">
        {principal()}
        <section className="grid gap-3" aria-labelledby="your-devices">
          <h2 id="your-devices" className="font-semibold">
            Your devices
          </h2>
          {deviceList()}
          <InstallCli />
        </section>
        <section className="grid gap-3" aria-labelledby="mcp-server">
          <h2 id="mcp-server" className="font-semibold">
            MCP server
          </h2>
          <McpServer />
        </section>
      </div>
      {revoking !== null && (
        <RevokeDeviceDialog tenantId={tenantId} device={revoking} onClose={() => setRevoking(null)} />
      )}
    </>
  );
};
