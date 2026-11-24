import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PrebuildStartSchema } from "@tumpel/schemas";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { failureOf, type Persona, type Prebuild, type PrebuildStart } from "../api/port";
import { Field } from "../components/field";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { useHashDialog } from "../hash-dialog";
import { repositoryName } from "../prebuild-rows";
import { NO_WIZARD_SEARCH } from "../prebuild-wizard";
import { prebuildKeys } from "../queries";

const ROUTE = "/t/$tenantId/prebuilds";

const problemCode = (error: unknown): string | null => {
  const failure = failureOf(error);
  return failure.kind === "Problem" ? failure.problem.code : null;
};

export const RebuildPrebuildDialog = ({
  tenantId,
  repository,
  latest,
  personas,
}: {
  tenantId: string;
  repository: string;
  latest: Prebuild | null;
  personas: UseQueryResult<Persona[]>;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: ROUTE });
  const dialog = useHashDialog();
  const open = dialog.isOpen("rebuild");
  const [pickedPersona, setPickedPersona] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const personaList = personas.data ?? [];
  const persona =
    pickedPersona ??
    personaList.find((item) => item.personaId === latest?.personaId)?.personaId ??
    personaList[0]?.personaId ??
    null;

  const reset = () => {
    setPickedPersona(null);
    setInvalid(null);
  };

  const start = useMutation({
    mutationFn: (body: PrebuildStart) => api.startPrebuild(body),
    onSuccess: (started) => {
      void queryClient.invalidateQueries({ queryKey: prebuildKeys.all(tenantId) });
      toast(`${repositoryName(started.repository)}: prebuild ${started.status.state}.`);
      start.reset();
      reset();
      void navigate({ hash: "", search: (prev) => ({ ...prev, repo: started.repository }) });
    },
  });

  const dismiss = () => {
    start.reset();
    reset();
    dialog.close();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = PrebuildStartSchema.safeParse({ repository, personaId: persona, rebuild: true });
    if (!parsed.success) {
      setInvalid("Pick a persona.");
      return;
    }
    setInvalid(null);
    start.mutate(parsed.data);
  };

  const personaField = () => {
    if (personas.isPending) return <Skeleton className="h-9 w-full" />;
    if (personas.isError) return <ProblemBlock error={personas.error} onRetry={() => void personas.refetch()} />;
    if (personaList.length === 0) {
      return <p className="text-sm">This tenant has no persona yet. Create one first: a prebuild runs as a persona.</p>;
    }
    return (
      <Field
        id="prebuild-persona"
        label="Persona"
        error={null}
        hint="Its harness version picks the guest image; its GITHUB_TOKEN reads the repository when the GitHub App does not cover it."
      >
        <NativeSelect
          id="prebuild-persona"
          value={persona ?? ""}
          onChange={(event) => setPickedPersona(event.target.value)}
        >
          {personaList.map((item) => (
            <option key={item.personaId} value={item.personaId}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogTitle>Rebuild {repositoryName(repository)}</DialogTitle>
          <DialogDescription>
            Starts a job even when a prebuild with the same inputs is stored. Tumpel reads the devcontainer files and
            lockfiles on the default branch.
          </DialogDescription>
          {personaField()}
          {invalid !== null && (
            <p role="alert" className="text-sm text-destructive">
              {invalid}
            </p>
          )}
          {start.isError && (
            <ProblemBlock
              error={start.error}
              actions={
                problemCode(start.error) === "DevcontainerMissing" && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/t/$tenantId/prebuilds/new/template"
                      params={{ tenantId }}
                      search={{ ...NO_WIZARD_SEARCH, repo: repositoryName(repository), persona }}
                    >
                      Pick a template
                    </Link>
                  </Button>
                )
              }
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" disabled={start.isPending || personas.isPending}>
              {start.isPending ? "Starting..." : "Rebuild"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
