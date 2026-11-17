import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PrebuildStartSchema } from "@tumpel/schemas";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { failureOf, type Persona, type Prebuild, type PrebuildStart } from "../api/port";
import { Field } from "../components/field";
import { ProblemBlock } from "../components/problem-block";
import { RepositoryPicker } from "../components/repository-picker";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { NativeSelect } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { useTenantApi } from "../context";
import { useHashDialog } from "../hash-dialog";
import { type BuildProviderName, PROVIDER_NAMES, repositoryName, shortDigest } from "../prebuild-rows";
import { prebuildKeys } from "../queries";
import { htmlUrlOf, pathOf, type RepositoryChoice, typedPathOf } from "../repository-picker";

const ROUTE = "/t/$tenantId/prebuilds";

const isNoBuildProvider = (error: unknown): boolean => {
  const failure = failureOf(error);
  return failure.kind === "Problem" && failure.problem.code === "NoBuildProvider";
};

export const RebuildPrebuildDialog = ({
  tenantId,
  repository,
  latest,
  providers,
  personas,
}: {
  tenantId: string;
  repository: string | null;
  latest: Prebuild | null;
  providers: readonly BuildProviderName[];
  personas: UseQueryResult<Persona[]>;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: ROUTE });
  const dialog = useHashDialog();
  const rebuild = dialog.isOpen("rebuild") && repository !== null;
  const open = dialog.isOpen("build") || rebuild;
  const [choice, setChoice] = useState<RepositoryChoice | null>(null);
  const [pickedProvider, setPickedProvider] = useState<BuildProviderName | null>(null);
  const [pickedPersona, setPickedPersona] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const target = rebuild || choice === null ? repository : htmlUrlOf(choice);
  const selected = choice === null ? (repository === null ? null : typedPathOf(repository)) : pathOf(choice);
  const provider =
    pickedProvider ?? (latest !== null && providers.includes(latest.provider) ? latest.provider : providers[0]) ?? null;
  const personaList = personas.data ?? [];
  const persona =
    pickedPersona ??
    personaList.find((item) => item.personaId === latest?.personaId)?.personaId ??
    personaList[0]?.personaId ??
    null;

  const reset = () => {
    setChoice(null);
    setPickedProvider(null);
    setPickedPersona(null);
    setInvalid(null);
  };

  const start = useMutation({
    mutationFn: (body: PrebuildStart) => api.startPrebuild(body),
    onSuccess: (started, body) => {
      const stored = [
        ...(queryClient.getQueryData<Prebuild[]>(prebuildKeys.latest(tenantId)) ?? []),
        ...(queryClient.getQueryData<Prebuild[]>(prebuildKeys.list(tenantId, started.repository)) ?? []),
      ];
      const reused = !body.rebuild && stored.some((item) => item.prebuildId === started.prebuildId);
      void queryClient.invalidateQueries({ queryKey: prebuildKeys.all(tenantId) });
      toast(
        reused
          ? `Same inputs as the stored prebuild ${shortDigest(started.inputDigest)}. No job started.`
          : `${repositoryName(started.repository)}: prebuild ${started.status.state} on ${PROVIDER_NAMES[started.provider]}.`,
      );
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
    const parsed = PrebuildStartSchema.safeParse({ repository: target, personaId: persona, provider, rebuild });
    if (!parsed.success) {
      setInvalid("Pick a repository, a persona and a connected provider.");
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
          <DialogTitle>
            {rebuild && repository !== null ? `Rebuild ${repositoryName(repository)}` : "Build a prebuild"}
          </DialogTitle>
          <DialogDescription>
            {rebuild
              ? "Starts a job even when a prebuild with the same inputs is stored."
              : "A stored prebuild with the same input digest answers at once and starts no job."}{" "}
            Tumpel reads the devcontainer files and lockfiles on the default branch.
          </DialogDescription>
          {!rebuild && (
            <RepositoryPicker
              tenantId={tenantId}
              id="prebuild-repository"
              selected={selected}
              acceptsTyped
              nextFocusId="prebuild-provider"
              onPick={setChoice}
            />
          )}
          <Field
            id="prebuild-provider"
            label="Provider"
            error={null}
            hint="The connected build provider that runs the job and bills it."
          >
            <NativeSelect
              id="prebuild-provider"
              value={provider ?? ""}
              onChange={(event) => setPickedProvider(providers.find((item) => item === event.target.value) ?? null)}
            >
              {providers.map((item) => (
                <option key={item} value={item}>
                  {PROVIDER_NAMES[item]}
                </option>
              ))}
            </NativeSelect>
          </Field>
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
                isNoBuildProvider(start.error) ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/t/$tenantId/connections" params={{ tenantId }} hash="providers">
                      Open Connections
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Cancel
            </Button>
            <Button type="submit" disabled={target === null || start.isPending || personas.isPending}>
              {start.isPending ? "Starting..." : rebuild ? "Rebuild" : "Build now"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
