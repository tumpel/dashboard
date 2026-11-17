import { type UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import type { EffectiveHarnessVersion, Harness, HarnessCatalogEntry, ReleaseManifest } from "../api/port";
import { HARNESS_LABELS } from "../catalog";
import { ConfirmDialog, type ConfirmMutation } from "../components/confirm-dialog";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { TableSkeleton } from "../components/table-skeleton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useTenantApi } from "../context";
import { cn } from "../lib";
import { keys, useCurrentRelease, useHarnessCatalog, useHarnessPins } from "../queries";

type PinChange =
  | { action: "Pin"; harness: Harness; harnessVersion: string; replaces: string | null }
  | { action: "Unpin"; harness: Harness; harnessVersion: string };

const releasedArchitectures = (release: ReleaseManifest, harness: Harness, harnessVersion: string): string[] =>
  release.images
    .filter((image) => image.harness === harness && image.harnessVersion === harnessVersion)
    .map((image) => image.architecture);

const ReleaseCell = ({ release, entry }: { release: UseQueryResult<ReleaseManifest>; entry: HarnessCatalogEntry }) => {
  if (release.isPending) return <span className="text-muted-foreground">...</span>;
  if (release.isError) return <span className="text-muted-foreground">release unavailable</span>;
  const architectures = releasedArchitectures(release.data, entry.harness, entry.harnessVersion);
  if (architectures.length === 0) return <Badge variant="warning">Not in release</Badge>;
  return <span>{architectures.join(", ")}</span>;
};

const PinDialog = ({
  change,
  mutation,
  onConfirm,
  onClose,
}: {
  change: PinChange;
  mutation: ConfirmMutation;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const label = HARNESS_LABELS[change.harness];
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={
        change.action === "Pin"
          ? `Pin ${label} to ${change.harnessVersion}?`
          : `Unpin ${label} ${change.harnessVersion}?`
      }
      description={
        <>
          <p>
            {change.action === "Unpin"
              ? `New sessions of ${label} run the catalog's default version.`
              : `New sessions of ${label} run ${change.harnessVersion}${change.replaces === null ? "." : `, in place of ${change.replaces}.`}`}
          </p>
          <p>Running sessions keep their version.</p>
        </>
      }
      cancelLabel="Cancel"
      confirmLabel={change.action === "Pin" ? `Pin ${change.harnessVersion}` : "Unpin"}
      pendingLabel="Saving..."
      destructive={false}
      confirmDisabled={false}
      mutation={mutation}
      refusalActions={null}
      onConfirm={onConfirm}
    />
  );
};

const CatalogTable = ({
  entries,
  versions,
  release,
  refusal,
  onChange,
}: {
  entries: HarnessCatalogEntry[];
  versions: EffectiveHarnessVersion[];
  release: UseQueryResult<ReleaseManifest>;
  refusal: { change: PinChange; error: Error } | null;
  onChange: (change: PinChange) => void;
}) => {
  const runs = new Map(versions.map((version) => [version.harness, version]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Harness</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Credentials</TableHead>
          <TableHead>Current release</TableHead>
          <TableHead>
            <span className="sr-only">Pin</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => {
          const effective = runs.get(entry.harness);
          const runsThis = effective?.harnessVersion === entry.harnessVersion;
          const pinned = effective?.pinned === true ? effective.harnessVersion : null;
          const isPinned = runsThis && pinned !== null;
          const isDefault = runsThis && pinned === null;
          const first = entries[index - 1]?.harness !== entry.harness;
          const refused =
            refusal !== null &&
            refusal.change.harness === entry.harness &&
            refusal.change.harnessVersion === entry.harnessVersion;
          return (
            <Fragment key={`${entry.harness}-${entry.harnessVersion}`}>
              <TableRow className={cn(isPinned && "bg-accent/40")}>
                <TableCell className="font-medium">{first ? HARNESS_LABELS[entry.harness] : ""}</TableCell>
                <TableCell className="font-mono text-[13px]">{entry.harnessVersion}</TableCell>
                <TableCell className="text-xs">
                  {entry.credentials.map(({ kind, provider }) => `${provider} ${kind}`).join(", ")}
                </TableCell>
                <TableCell>
                  <ReleaseCell release={release} entry={entry} />
                </TableCell>
                <TableCell>
                  {isPinned ? (
                    <span className="flex items-center gap-2">
                      <Badge variant="primary">Pinned</Badge>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          onChange({
                            action: "Unpin",
                            harness: entry.harness,
                            harnessVersion: entry.harnessVersion,
                          })
                        }
                      >
                        Unpin
                      </Button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onChange({
                            action: "Pin",
                            harness: entry.harness,
                            harnessVersion: entry.harnessVersion,
                            replaces: pinned,
                          })
                        }
                      >
                        Pin
                      </Button>
                      {isDefault && <Badge>Default</Badge>}
                    </span>
                  )}
                </TableCell>
              </TableRow>
              {refused && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <ProblemBlock error={refusal.error} />
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

export const HarnessesScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/harnesses" });
  const { harness: chosen } = useSearch({ from: "/t/$tenantId/harnesses" });
  const navigate = useNavigate({ from: "/t/$tenantId/harnesses" });
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const catalog = useHarnessCatalog(tenantId);
  const pins = useHarnessPins(tenantId);
  const release = useCurrentRelease(tenantId);
  const [change, setChange] = useState<PinChange | null>(null);
  const save = useMutation({
    mutationFn: async (next: PinChange) => {
      if (next.action === "Pin") {
        await api.pinHarness({ harness: next.harness, harnessVersion: next.harnessVersion });
        return;
      }
      await api.unpinHarness(next.harness);
    },
    onSuccess: (_, next) => {
      void queryClient.invalidateQueries({ queryKey: keys.harnessPins(tenantId) });
      toast(
        next.action === "Pin"
          ? `${HARNESS_LABELS[next.harness]} pinned to ${next.harnessVersion}. New sessions run it.`
          : `${HARNESS_LABELS[next.harness]} unpinned. New sessions run the default version.`,
      );
    },
    onSettled: () => setChange(null),
  });
  const refusal = save.isError && save.variables !== undefined ? { change: save.variables, error: save.error } : null;
  const harnesses = [...new Set((catalog.data ?? []).map((entry) => entry.harness))];
  const toggle = (harness: Harness) =>
    void navigate({
      search: { harness: chosen.includes(harness) ? chosen.filter((item) => item !== harness) : [...chosen, harness] },
    });
  const body = () => {
    if (catalog.isPending || pins.isPending) return <TableSkeleton rows={5} />;
    if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
    if (pins.isError) return <ProblemBlock error={pins.error} onRetry={() => void pins.refetch()} />;
    const entries = catalog.data.filter((entry) => chosen.length === 0 || chosen.includes(entry.harness));
    return (
      <div className="grid gap-3">
        {release.isError && (
          <ProblemBlock error={release.error} onRetry={() => void release.refetch()} className="text-sm" />
        )}
        <CatalogTable
          entries={entries}
          versions={pins.data}
          release={release}
          refusal={refusal}
          onChange={(next) => {
            save.reset();
            setChange(next);
          }}
        />
        {release.isSuccess && (
          <p className="text-xs text-muted-foreground">
            Current release {release.data.releaseVersion}. A version it carries no image of cannot start sessions.
          </p>
        )}
      </div>
    );
  };
  return (
    <>
      <PageHeader title="Harnesses" />
      <p className="mb-3 text-sm text-muted-foreground">
        A pin sets the version new sessions of that harness run. Running sessions keep theirs.
      </p>
      {harnesses.length > 1 && (
        <fieldset className="mb-4 flex flex-wrap gap-2">
          <legend className="sr-only">Filter by harness</legend>
          {harnesses.map((harness) => {
            const on = chosen.includes(harness);
            return (
              <button
                key={harness}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(harness)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {HARNESS_LABELS[harness]}
                {on && <XIcon className="size-3" aria-hidden />}
              </button>
            );
          })}
        </fieldset>
      )}
      {body()}
      {change !== null && (
        <PinDialog
          change={change}
          mutation={save}
          onConfirm={() => save.mutate(change)}
          onClose={() => setChange(null)}
        />
      )}
    </>
  );
};
