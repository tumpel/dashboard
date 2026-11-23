import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ConnectorUpdateSchema, StaticConnectorCreateSchema, StaticConnectorTokenWriteSchema } from "@tumpel/schemas";
import { EllipsisIcon, ExternalLinkIcon } from "lucide-react";
import { type FormEvent, Fragment, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { Connector, ConnectorStatus, Persona } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { TableSkeleton } from "../components/table-skeleton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input, NativeSelect } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { authorizationSettled, type PendingAuthorization } from "../connectors";
import { useTenantApi } from "../context";
import { formatDate } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { keys, useConnectors, useOwner, usePersonas, useWhoami } from "../queries";
import { fieldErrors } from "./connection-dialogs";

type Auth = Connector["auth"];
type Failed = Extract<ConnectorStatus, { state: "AuthorizationFailed" }>;
type Action = { kind: "Token" | "Rename" | "Clear" | "Delete"; connectorId: string };

const ADD_HASH = "add";
const OWNER_ONLY = "Only an Owner adds, connects or removes connectors. Owners are listed under Members.";

const AUTH_LABELS: Record<Auth, string> = { Static: "Static token", OAuth: "OAuth" };

const FAILURES: Record<Failed["reason"], { title: string; fix: string }> = {
  AuthorizationDenied: {
    title: "Authorization denied",
    fix: "Authorize again and approve on the provider's page.",
  },
  AuthorizationExpired: {
    title: "Authorization expired",
    fix: "Authorize again and finish on the provider's page within 10 minutes.",
  },
  TokenExchangeFailed: {
    title: "Token exchange failed",
    fix: "Authorize again. If it fails again, the server's OAuth setup needs a fix on the provider's side.",
  },
  RefreshRefused: {
    title: "Token refresh refused",
    fix: "Authorize again to grant a new token.",
  },
};

const day = (iso: string): string => formatDate(Date.parse(iso));

const openTab = (): Window | null => {
  const tab = window.open("", "_blank");
  if (tab !== null) tab.opener = null;
  return tab;
};

const useRefreshConnectors = (tenantId: string) => {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: keys.connectors(tenantId) });
};

const StatusBadge = ({ status, waiting }: { status: ConnectorStatus; waiting: boolean }) => {
  if (status.state === "Unrecognised") return <Badge variant="outline">Unrecognised</Badge>;
  if (waiting) return <Badge variant="warning">Waiting for approval</Badge>;
  if (status.state === "Connected") return <Badge variant="success">Connected {day(status.connectedAt)}</Badge>;
  if (status.state === "Disconnected") return <Badge variant="grey">Disconnected {day(status.disconnectedAt)}</Badge>;
  if (status.state === "AuthorizationFailed") return <Badge variant="destructive">Authorization failed</Badge>;
  return <Badge variant="outline">Not connected</Badge>;
};

const useAuthorization = (tenantId: string) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnectors(tenantId);
  const [pending, setPending] = useState<PendingAuthorization | null>(null);
  const authorize = useMutation({
    mutationFn: ({ connector }: { connector: Connector; tab: Window | null }) => api.authorizeConnector(connector),
    onSuccess: (started, { connector, tab }) => {
      if (tab !== null) tab.location.href = started.authorizeUrl;
      setPending({
        connectorId: connector.connectorId,
        before: connector.status,
        authorizeUrl: started.authorizeUrl,
        callbackDueAt: started.callbackDueAt,
      });
    },
    onError: (_, { tab }) => tab?.close(),
    onSettled: refresh,
  });
  return {
    pending,
    authorize,
    start: (connector: Connector, tab: Window | null) => {
      setPending(null);
      authorize.mutate({ connector, tab });
    },
    settle: () => setPending(null),
  };
};

const AddConnectorDialog = ({
  tenantId,
  onAuthorize,
}: {
  tenantId: string;
  onAuthorize: (connector: Connector, tab: Window | null) => void;
}) => {
  const api = useTenantApi(tenantId);
  const dialog = useHashDialog();
  const refresh = useRefreshConnectors(tenantId);
  const id = useId();
  const [auth, setAuth] = useState<Auth>("Static");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [created, setCreated] = useState<Connector | null>(null);
  const dismiss = () => {
    add.reset();
    setName("");
    setUrl("");
    setToken("");
    setCreated(null);
    setErrors(new Map());
    dialog.close();
  };
  const add = useMutation({
    mutationFn: async ({ value }: { value: string; tab: Window | null }) => {
      const connector = created ?? (await api.createConnector(auth, { name: name.trim(), url: url.trim() }));
      setCreated(connector);
      if (connector.auth === "Static") return api.setConnectorToken(connector, value);
      return connector;
    },
    onSuccess: (connector, { tab }) => {
      dismiss();
      if (connector.auth === "OAuth") {
        onAuthorize(connector, tab);
        return;
      }
      toast(`${connector.name} connected. Add it to a persona so its sessions can use it.`);
    },
    onError: (_, { tab }) => tab?.close(),
    onSettled: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = StaticConnectorCreateSchema.safeParse({ name: name.trim(), url: url.trim() });
    const secret = auth === "Static" ? StaticConnectorTokenWriteSchema.safeParse({ value: token }) : null;
    const found = new Map([
      ...(fields.success ? [] : fieldErrors(fields.error)),
      ...(secret === null || secret.success ? [] : [["value", "Paste the token the server expects."] as const]),
    ]);
    setErrors(found);
    if (found.size > 0) return;
    add.mutate({ value: token, tab: auth === "OAuth" ? openTab() : null });
  };
  const nameError = errors.get("name") ?? null;
  const urlError = errors.get("url") === undefined ? null : "Give the server's https address, with no query.";
  const tokenError = errors.get("value") ?? null;
  return (
    <Dialog open={dialog.isOpen(ADD_HASH)} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-xl">
        <form className="grid gap-4" onSubmit={submit} noValidate autoComplete="off">
          <DialogTitle>Add a connector</DialogTitle>
          <DialogDescription>
            A connector is a remote MCP server. Sessions on a persona that lists it can call its tools.
          </DialogDescription>
          <Field
            id={`${id}-auth`}
            label="Sign-in"
            error={null}
            hint={
              auth === "Static"
                ? "The server takes one token, sent as a bearer token on every call."
                : "The server signs you in through OAuth. Its page opens in a new tab to approve access."
            }
          >
            <NativeSelect
              id={`${id}-auth`}
              value={auth}
              disabled={created !== null}
              onChange={(event) => setAuth(event.target.value === "OAuth" ? "OAuth" : "Static")}
            >
              <option value="Static">{AUTH_LABELS.Static}</option>
              <option value="OAuth">{AUTH_LABELS.OAuth}</option>
            </NativeSelect>
          </Field>
          <Field id={`${id}-name`} label="Name" error={nameError} hint={null}>
            <Input
              id={`${id}-name`}
              value={name}
              disabled={created !== null}
              aria-invalid={nameError !== null}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field id={`${id}-url`} label="Server address" error={urlError} hint="Fixed once the connector exists.">
            <Input
              id={`${id}-url`}
              value={url}
              placeholder="https://mcp.example.com/mcp"
              spellCheck={false}
              disabled={created !== null}
              aria-invalid={urlError !== null}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
          {auth === "Static" && (
            <Field
              id={`${id}-token`}
              label="Token"
              error={tokenError}
              hint="Stored sealed. Nobody can read it back, you included."
            >
              <Input
                id={`${id}-token`}
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={token}
                aria-invalid={tokenError !== null}
                onChange={(event) => setToken(event.target.value)}
              />
            </Field>
          )}
          {add.isError && <ProblemBlock error={add.error} />}
          {add.isError && created !== null && (
            <p className="text-sm">{created.name} was added without its token. Add saves the token to it.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adding..." : auth === "OAuth" ? "Add and authorize" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TokenDialog = ({
  tenantId,
  connector,
  onClose,
}: {
  tenantId: string;
  connector: Connector;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnectors(tenantId);
  const id = useId();
  const [token, setToken] = useState("");
  const [missing, setMissing] = useState(false);
  const save = useMutation({
    mutationFn: (value: string) => api.setConnectorToken(connector, value),
    onSuccess: (saved) => {
      toast(`${saved.name} connected. Running sessions get the new token at their next call.`);
      onClose();
    },
    onSettled: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = StaticConnectorTokenWriteSchema.safeParse({ value: token });
    setMissing(!parsed.success);
    if (parsed.success) save.mutate(parsed.data.value);
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit} noValidate autoComplete="off">
          <DialogTitle>Set the token of {connector.name}</DialogTitle>
          <DialogDescription>
            The new token replaces any earlier one. It is stored sealed and never shown again.
          </DialogDescription>
          <Field
            id={`${id}-token`}
            label="Token"
            error={missing ? "Paste the token the server expects." : null}
            hint={null}
          >
            <Input
              id={`${id}-token`}
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={token}
              aria-invalid={missing}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
          {save.isError && <ProblemBlock error={save.error} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save token"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RenameDialog = ({
  tenantId,
  connector,
  onClose,
}: {
  tenantId: string;
  connector: Connector;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnectors(tenantId);
  const id = useId();
  const [name, setName] = useState(connector.name);
  const [invalid, setInvalid] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: (next: string) => api.updateConnector(connector, { name: next }),
    onSuccess: (saved) => {
      toast(`Renamed to ${saved.name}.`);
      onClose();
    },
    onSettled: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = ConnectorUpdateSchema.safeParse({ name: name.trim() });
    setInvalid(parsed.success ? null : (fieldErrors(parsed.error).get("name") ?? null));
    if (parsed.success) rename.mutate(parsed.data.name);
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <DialogTitle>Rename {connector.name}</DialogTitle>
          <DialogDescription>
            The server address and sign-in stay. A new address needs a new connector.
          </DialogDescription>
          <Field id={`${id}-name`} label="Name" error={invalid} hint={null}>
            <Input
              id={`${id}-name`}
              value={name}
              aria-invalid={invalid !== null}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {rename.isError && <ProblemBlock error={rename.error} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? "Saving..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ClearDialog = ({
  tenantId,
  connector,
  onClose,
}: {
  tenantId: string;
  connector: Connector;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnectors(tenantId);
  const clear = useMutation({
    mutationFn: () => api.clearConnectorCredential(connector),
    onSuccess: (saved) => {
      toast(`${saved.name} disconnected. New sessions start without it.`);
      onClose();
    },
    onSettled: refresh,
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Disconnect ${connector.name}?`}
      description={
        <>
          <p>
            New turns are refused while it is disconnected. Running turns keep it until they end; stop them to cut it
            off sooner.
          </p>
          {connector.auth === "OAuth" && (
            <p>The grant stays in place on the provider's side. Revoke it on the provider's site to end it there.</p>
          )}
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Disconnect"
      pendingLabel="Disconnecting..."
      destructive
      confirmDisabled={false}
      mutation={clear}
      refusalActions={null}
      onConfirm={() => clear.mutate()}
    />
  );
};

const DeleteDialog = ({
  tenantId,
  connector,
  usedBy,
  onClose,
}: {
  tenantId: string;
  connector: Connector;
  usedBy: Persona[];
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const refresh = useRefreshConnectors(tenantId);
  const remove = useMutation({
    mutationFn: () => api.deleteConnector(connector),
    onSuccess: () => {
      toast(`${connector.name} deleted.`);
      onClose();
    },
    onSettled: refresh,
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Delete ${connector.name}?`}
      description={
        <>
          <p>The connector and its credential are deleted. Sessions that already have it run later turns without it.</p>
          {usedBy.length > 0 && (
            <p className="font-semibold text-foreground">
              {usedBy.map((persona) => persona.name).join(", ")} still {usedBy.length === 1 ? "lists" : "list"} it.
              Remove it from {usedBy.length === 1 ? "that persona" : "those personas"} first.
            </p>
          )}
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Delete"
      pendingLabel="Deleting..."
      destructive
      confirmDisabled={false}
      mutation={remove}
      refusalActions={null}
      onConfirm={() => remove.mutate()}
    />
  );
};

const RowActions = ({
  connector,
  onAction,
  onAuthorize,
}: {
  connector: Connector;
  onAction: (kind: Action["kind"]) => void;
  onAuthorize: () => void;
}) => {
  const connected = connector.status.state === "Connected";
  return (
    <span className="flex justify-end gap-2">
      {connector.auth === "OAuth" ? (
        <Button size="sm" variant="outline" onClick={onAuthorize}>
          {connected ? "Authorize again" : "Authorize"}
          <ExternalLinkIcon aria-hidden />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => onAction("Token")}>
          {connected ? "Replace token" : "Set token"}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label={`More actions for ${connector.name}`}>
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => onAction("Rename")}>Rename</DropdownMenuItem>
          {connected && <DropdownMenuItem onSelect={() => onAction("Clear")}>Disconnect</DropdownMenuItem>}
          <DropdownMenuItem className="text-destructive" onSelect={() => onAction("Delete")}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};

export const ConnectorRows = ({
  connectors,
  personas,
  owner,
  pending,
  onAction,
  onAuthorize,
}: {
  connectors: Connector[];
  personas: Persona[] | undefined;
  owner: boolean;
  pending: PendingAuthorization | null;
  onAction: (action: Action) => void;
  onAuthorize: (connector: Connector) => void;
}) => {
  const columns = owner ? 6 : 5;
  return (
    <Table mobile>
      <TableHeader>
        <TableRow>
          <TableHead>Connector</TableHead>
          <TableHead>Server address</TableHead>
          <TableHead>Sign-in</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Used by</TableHead>
          {owner && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {connectors.map((connector) => {
          const waiting = pending?.connectorId === connector.connectorId;
          const { status } = connector;
          const usedBy = personas?.filter((persona) => persona.connectorIds.includes(connector.connectorId));
          return (
            <Fragment key={connector.connectorId}>
              <TableRow>
                <TableCell mobile="primary" className="font-medium">
                  {connector.name}
                </TableCell>
                <TableCell
                  label="Server address"
                  className="font-mono text-[13px] sm:max-w-72 sm:truncate"
                  title={connector.url}
                >
                  {connector.url}
                </TableCell>
                <TableCell label="Sign-in">{AUTH_LABELS[connector.auth]}</TableCell>
                <TableCell mobile="summary">
                  <StatusBadge status={status} waiting={waiting} />
                </TableCell>
                <TableCell label="Used by">
                  {usedBy === undefined ? (
                    <span className="text-muted-foreground">unavailable</span>
                  ) : usedBy.length === 0 ? (
                    <span className="text-muted-foreground">none</span>
                  ) : (
                    usedBy.map((persona) => persona.name).join(", ")
                  )}
                </TableCell>
                {owner && (
                  <TableCell mobile="action">
                    <RowActions
                      connector={connector}
                      onAction={(kind) => onAction({ kind, connectorId: connector.connectorId })}
                      onAuthorize={() => onAuthorize(connector)}
                    />
                  </TableCell>
                )}
              </TableRow>
              {waiting && (
                <TableRow>
                  <TableCell mobile="full" colSpan={columns} className="text-sm">
                    Approve access on the provider's page in the other tab. This row updates once you do.{" "}
                    <a className="text-primary underline" href={pending.authorizeUrl} target="_blank" rel="noreferrer">
                      Open the provider's page again
                    </a>
                  </TableCell>
                </TableRow>
              )}
              {status.state === "Unrecognised" && (
                <TableRow>
                  <TableCell mobile="full" colSpan={columns}>
                    <p role="status">This dashboard doesn't recognise what the service sent. Reload to update.</p>
                  </TableCell>
                </TableRow>
              )}
              {!waiting && status.state === "AuthorizationFailed" && (
                <TableRow>
                  <TableCell mobile="full" colSpan={columns}>
                    <div role="alert" className="grid gap-0.5 text-sm">
                      <span className="font-semibold text-destructive">
                        {FAILURES[status.reason].title} {day(status.failedAt)}
                      </span>
                      <span>{status.detail}</span>
                      <span className="text-muted-foreground">
                        {owner ? FAILURES[status.reason].fix : "Ask an Owner to authorize it again."}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
};

export const ConnectorsScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/connectors" });
  const whoami = useWhoami(tenantId);
  const owner = useOwner(tenantId);
  const authorization = useAuthorization(tenantId);
  const { pending, settle } = authorization;
  const connectors = useConnectors(tenantId, pending);
  const personas = usePersonas(tenantId);
  const [action, setAction] = useState<Action | null>(null);
  const chosen = connectors.data?.find((connector) => connector.connectorId === action?.connectorId);
  const close = () => setAction(null);
  const authorize = (connector: Connector) => authorization.start(connector, openTab());

  useEffect(() => {
    if (pending === null) return;
    const connector = connectors.data?.find((item) => item.connectorId === pending.connectorId);
    if (connector === undefined || !authorizationSettled(pending, connector.status)) return;
    settle();
    toast(
      connector.status.state === "Connected"
        ? `${connector.name} connected. Add it to a persona so its sessions can use it.`
        : `${connector.name} was not authorized. Its row says why.`,
    );
  }, [pending, connectors.data, settle]);

  const add = (label: string) =>
    owner ? (
      <Button asChild>
        <Link to="." hash={ADD_HASH} search={(search) => search}>
          {label}
        </Link>
      </Button>
    ) : undefined;

  const body = () => {
    if (connectors.isPending) return <TableSkeleton rows={3} />;
    if (connectors.isError) return <ProblemBlock error={connectors.error} onRetry={() => void connectors.refetch()} />;
    if (connectors.data.length === 0) {
      return (
        <EmptyState
          title="No connectors yet"
          detail="A connector is a remote MCP server, such as an issue tracker or a docs search. Sessions on a persona that lists it can call its tools."
          action={add("Add a connector") ?? <p className="text-sm">{OWNER_ONLY}</p>}
        />
      );
    }
    return (
      <div className="grid gap-3">
        {personas.isError && <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />}
        {authorization.authorize.isError && <ProblemBlock error={authorization.authorize.error} />}
        <ConnectorRows
          connectors={connectors.data}
          personas={personas.data}
          owner={owner}
          pending={pending}
          onAction={setAction}
          onAuthorize={authorize}
        />
        <p className="text-sm text-muted-foreground">
          Tokens and grants are never shown. Connectors are shared by everyone in this tenant.
        </p>
        {whoami.isSuccess && !owner && <p className="text-sm">{OWNER_ONLY}</p>}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Connectors"
        actions={connectors.isSuccess && connectors.data.length > 0 ? add("Add connector") : undefined}
      />
      {body()}
      {owner && <AddConnectorDialog tenantId={tenantId} onAuthorize={authorization.start} />}
      {chosen !== undefined && action?.kind === "Token" && (
        <TokenDialog tenantId={tenantId} connector={chosen} onClose={close} />
      )}
      {chosen !== undefined && action?.kind === "Rename" && (
        <RenameDialog tenantId={tenantId} connector={chosen} onClose={close} />
      )}
      {chosen !== undefined && action?.kind === "Clear" && (
        <ClearDialog tenantId={tenantId} connector={chosen} onClose={close} />
      )}
      {chosen !== undefined && action?.kind === "Delete" && (
        <DeleteDialog
          tenantId={tenantId}
          connector={chosen}
          usedBy={personas.data?.filter((persona) => persona.connectorIds.includes(chosen.connectorId)) ?? []}
          onClose={close}
        />
      )}
    </>
  );
};
