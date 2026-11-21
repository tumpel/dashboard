import { Link, useParams } from "@tanstack/react-router";
import { HARNESS_LABELS } from "../catalog";
import { EmptyState } from "../components/empty-state";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { formatKib } from "../fleet";
import { usePersonas, useSecretSets } from "../queries";

export const PersonasListScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/personas" });
  const personas = usePersonas(tenantId);
  const secretSets = useSecretSets(tenantId);
  const create = (label: string) => (
    <Button asChild>
      <Link to="/t/$tenantId/personas/new" params={{ tenantId }} search={{ harness: [], file: [] }}>
        {label}
      </Link>
    </Button>
  );
  const secretSetName = (secretSetId: string): string => {
    if (secretSets.isError) return secretSetId;
    return secretSets.data?.find((set) => set.secretSetId === secretSetId)?.name ?? secretSetId;
  };
  const body = () => {
    if (personas.isPending) return <TableSkeleton rows={3} />;
    if (personas.isError) return <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />;
    if (personas.data.length === 0) {
      return (
        <EmptyState
          title="No personas yet"
          detail="A persona picks a harness, its config files and a secret set."
          action={create("Create a persona")}
        />
      );
    }
    return (
      <div className="grid gap-3">
        {secretSets.isError && <ProblemBlock error={secretSets.error} onRetry={() => void secretSets.refetch()} />}
        <Table mobile>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Harness</TableHead>
              <TableHead>Secret set</TableHead>
              <TableHead>Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personas.data.map((persona) => (
              <TableRow key={persona.personaId}>
                <TableCell mobile="primary">
                  <Link
                    to="/t/$tenantId/personas/$personaId"
                    params={{ tenantId, personaId: persona.personaId }}
                    search={{ file: [] }}
                    className="font-medium hover:underline"
                  >
                    {persona.name}
                  </Link>
                </TableCell>
                <TableCell mobile="summary">{HARNESS_LABELS[persona.harness]}</TableCell>
                <TableCell label="Secret set">
                  <Link
                    to="/t/$tenantId/secrets/$secretSetId"
                    params={{ tenantId, secretSetId: persona.secretSetId }}
                    className="hover:underline"
                  >
                    {secretSetName(persona.secretSetId)}
                  </Link>
                </TableCell>
                <TableCell label="Files">
                  {persona.files.length}, {formatKib(persona.files.reduce((total, file) => total + file.sizeBytes, 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  return (
    <>
      <PageHeader
        title="Personas"
        actions={personas.isSuccess && personas.data.length === 0 ? undefined : create("Create persona")}
      />
      {body()}
    </>
  );
};
