import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Persona, SecretKey, SecretSet } from "../api/port";
import { UNRECOGNISED_LABEL } from "../api/wording";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useTenantApi } from "../context";
import { expiryDate, formatTime, SECRET_KIND_NAMES } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { keys, usePersonas, useSecretSet } from "../queries";
import { OpenRouterSection } from "./openrouter-connect";

const isExpired = (key: SecretKey, now: number): boolean =>
  key.kind === "SubscriptionToken" && Date.parse(key.expiresAt) <= now;

const namesOf = (personas: Persona[]): string => personas.map((persona) => persona.name).join(" and ");

const DeleteSecretSetDialog = ({ tenantId, secretSet }: { tenantId: string; secretSet: SecretSet }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialog = useHashDialog();
  const remove = useMutation({
    mutationFn: () => api.deleteSecretSet(secretSet.secretSetId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.secretSet(tenantId, secretSet.secretSetId) });
      void queryClient.invalidateQueries({ queryKey: keys.secretSets(tenantId) });
      toast(`${secretSet.name} deleted with its stored values.`);
      void navigate({ to: "/t/$tenantId/secrets", params: { tenantId } });
    },
  });
  return (
    <ConfirmDialog
      open={dialog.isOpen("delete")}
      onClose={dialog.close}
      title={`Delete ${secretSet.name}?`}
      description="The set and every stored value go. A set that a persona names cannot be deleted."
      cancelLabel="Cancel"
      confirmLabel="Delete secret set"
      pendingLabel="Deleting..."
      destructive
      confirmDisabled={false}
      mutation={remove}
      refusalActions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/t/$tenantId/personas" params={{ tenantId }}>
            Open Personas
          </Link>
        </Button>
      }
      onConfirm={() => remove.mutate()}
    />
  );
};

export const SecretSetDetailScreen = () => {
  const { tenantId, secretSetId } = useParams({ from: "/t/$tenantId/secrets/$secretSetId" });
  const secretSet = useSecretSet(tenantId, secretSetId);
  const { openRouterAuthorizationId } = useSearch({ from: "/t/$tenantId/secrets/$secretSetId" });
  const personas = usePersonas(tenantId);
  const crumb = (
    <Link to="/t/$tenantId/secrets" params={{ tenantId }} className="hover:underline">
      Secret sets /
    </Link>
  );
  if (secretSet.isPending) {
    return (
      <>
        <PageHeader title="Secret set" crumb={crumb} />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }
  if (secretSet.isError) {
    return (
      <>
        <PageHeader title="Secret set" crumb={crumb} />
        <ProblemBlock error={secretSet.error} onRetry={() => void secretSet.refetch()} />
      </>
    );
  }
  const set = secretSet.data;
  const now = Date.now();
  const users = (personas.data ?? []).filter((persona) => persona.secretSetId === set.secretSetId);
  const expired = set.keys.flatMap((key) => (key.kind === "SubscriptionToken" && isExpired(key, now) ? [key] : []));
  return (
    <>
      <PageHeader
        title={set.name}
        crumb={crumb}
        actions={
          <>
            <Button asChild>
              <Link to="/t/$tenantId/secrets/$secretSetId/add" params={{ tenantId, secretSetId }} search={{}}>
                Add a secret
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                to="/t/$tenantId/secrets/$secretSetId/edit"
                params={{ tenantId, secretSetId }}
                search={{ replace: [] }}
              >
                Edit
              </Link>
            </Button>
            <Button variant="destructive" asChild>
              <Link to="." hash="delete">
                Delete
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4">
        {expired.map((key) => (
          <ProblemCard
            key={key.name}
            wording={{
              title: `${key.name} expired ${expiryDate(key.expiresAt)}`,
              detail:
                users.length === 0
                  ? "Sessions on this set fail (CredentialExpired) until you replace the token."
                  : `Sessions of ${namesOf(users)} fail (CredentialExpired) until you replace the token.`,
              fix: "Make a new subscription token with the harness, then Replace value with it and its expiry.",
            }}
            actions={
              <Button size="sm" variant="outline" asChild>
                <Link
                  to="/t/$tenantId/secrets/$secretSetId/edit"
                  params={{ tenantId, secretSetId }}
                  search={{ replace: [key.name] }}
                >
                  Replace value
                </Link>
              </Button>
            }
          />
        ))}
        {openRouterAuthorizationId !== undefined && (
          <OpenRouterSection
            tenantId={tenantId}
            secretSet={set}
            openRouterAuthorizationId={openRouterAuthorizationId}
          />
        )}
        <Table mobile>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {set.keys.map((key) =>
              key.kind === "Unrecognised" ? null : (
                <TableRow key={key.name}>
                  <TableCell mobile="primary" className="font-mono text-[13px]">
                    {key.name}
                  </TableCell>
                  <TableCell label="Kind">{SECRET_KIND_NAMES[key.kind]}</TableCell>
                  <TableCell label="Provider">{key.kind === "Variable" ? "" : key.provider}</TableCell>
                  <TableCell mobile="summary">
                    {key.kind !== "SubscriptionToken" ? null : isExpired(key, now) ? (
                      <Badge variant="destructive">Expired {expiryDate(key.expiresAt)}</Badge>
                    ) : (
                      expiryDate(key.expiresAt)
                    )}
                  </TableCell>
                  <TableCell label="Updated">{formatTime(key.updatedAt)}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
        {set.keys.length === 0 && <p className="text-sm text-muted-foreground">This set holds no secrets yet.</p>}
        {set.keys.some((key) => key.kind === "Unrecognised") && (
          <p className="text-sm">
            {UNRECOGNISED_LABEL}: this set also holds a secret this dashboard does not recognise.
          </p>
        )}
        {personas.isError ? (
          <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />
        ) : (
          <p className="text-sm">
            Used by:{" "}
            {personas.isPending ? "..." : users.length === 0 ? "no persona" : users.map((user) => user.name).join(", ")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Values are never shown. Edit to replace them.</p>
      </div>
      <DeleteSecretSetDialog tenantId={tenantId} secretSet={set} />
    </>
  );
};
