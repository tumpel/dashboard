import { Link, useParams } from "@tanstack/react-router";
import type { Persona, SecretKey, SecretSet } from "../api/port";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { TableSkeleton } from "../components/table-skeleton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { expiryDate } from "../fleet";
import { usePersonas, useSecretSets } from "../queries";
import { ConfigImport } from "./config-import";

const soonestExpiry = (secretSet: SecretSet): string | undefined =>
  secretSet.keys
    .flatMap((key) => (key.kind === "SubscriptionToken" ? [key.expiresAt] : []))
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

const credentialLabel = (key: SecretKey): string => {
  if (key.kind === "ApiKey") return `${key.provider} key`;
  if (key.kind === "SubscriptionToken") return `${key.provider} token`;
  return key.name;
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const UsedBy = ({ personas, secretSetId }: { personas: Persona[] | undefined; secretSetId: string }) => {
  if (personas === undefined) return <span className="text-muted-foreground">unavailable</span>;
  const count = personas.filter((persona) => persona.secretSetId === secretSetId).length;
  if (count === 0) return <span className="text-muted-foreground">none</span>;
  return <span>{plural(count, "persona", "personas")}</span>;
};

export const SecretSetsListScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/secrets" });
  const secretSets = useSecretSets(tenantId);
  const personas = usePersonas(tenantId);
  const now = Date.now();
  const create = (label: string) => (
    <Button asChild>
      <Link to="/t/$tenantId/secrets/new" params={{ tenantId }}>
        {label}
      </Link>
    </Button>
  );
  const body = () => {
    if (secretSets.isPending) return <TableSkeleton rows={3} />;
    if (secretSets.isError) {
      return <ProblemBlock error={secretSets.error} onRetry={() => void secretSets.refetch()} />;
    }
    if (secretSets.data.length === 0) {
      return (
        <EmptyState
          title="No secret sets yet"
          detail="A secret set holds the provider credentials and variables a persona's sessions get."
          action={create("Create a secret set")}
        />
      );
    }
    return (
      <div className="grid gap-3">
        {personas.isError && <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />}
        <Table mobile>
          <TableHeader>
            <TableRow>
              <TableHead>Secret set</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Credentials</TableHead>
              <TableHead>Soonest expiry</TableHead>
              <TableHead>Used by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secretSets.data.map((set) => {
              const credentials = set.keys.filter((key) => key.kind !== "Variable");
              const soonest = soonestExpiry(set);
              return (
                <TableRow key={set.secretSetId}>
                  <TableCell mobile="primary">
                    <Link
                      to="/t/$tenantId/secrets/$secretSetId"
                      params={{ tenantId, secretSetId: set.secretSetId }}
                      className="font-medium hover:underline"
                    >
                      {set.name}
                    </Link>
                  </TableCell>
                  <TableCell label="Members">{set.keys.length}</TableCell>
                  <TableCell label="Credentials" className="text-xs">
                    {credentials.length === 0 ? (
                      <span className="text-muted-foreground">none</span>
                    ) : (
                      credentials.map(credentialLabel).join(", ")
                    )}
                  </TableCell>
                  <TableCell mobile="state">
                    {soonest === undefined ? null : Date.parse(soonest) <= now ? (
                      <Badge variant="destructive">Expired {expiryDate(soonest)}</Badge>
                    ) : (
                      expiryDate(soonest)
                    )}
                  </TableCell>
                  <TableCell label="Used by">
                    <UsedBy personas={personas.data} secretSetId={set.secretSetId} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Values are never shown. The API returns names, kinds, providers and expiries only.
        </p>
      </div>
    );
  };
  return (
    <>
      <PageHeader
        title="Secret sets"
        actions={secretSets.isSuccess && secretSets.data.length === 0 ? undefined : create("Create secret set")}
      />
      {body()}
      <ConfigImport tenantId={tenantId} />
    </>
  );
};
