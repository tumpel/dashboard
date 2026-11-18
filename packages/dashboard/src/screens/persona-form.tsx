import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { PersonaFileLimit } from "@tumpel/schemas";
import { LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type EffectiveHarnessVersion,
  failureOf,
  type Harness,
  type HarnessCatalogEntry,
  type Persona,
  type PersonaFileWrite,
  type SecretSet,
  type TumpelApi,
} from "../api/port";
import { HARNESS_LABELS } from "../catalog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Field } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProblemBlock, ProblemCard } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Skeleton } from "../components/ui/skeleton";
import { useUnsavedGuard } from "../components/unsaved-guard";
import { useTenantApi } from "../context";
import { formatKib } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { keys, useHarnessCatalog, useHarnessPins, usePersona, useSecretSets } from "../queries";

type FileDraft =
  | { kind: "Stored"; digest: string; sizeBytes: number }
  | { kind: "Changed"; bytes: Uint8Array<ArrayBuffer>; text: string };

type Drafts = Record<string, FileDraft>;

interface Upload {
  path: string;
  sizeBytes: number;
}

const INLINE_FILE_BYTES = PersonaFileLimit.InlineFileBytes;
const PERSONA_BYTES = PersonaFileLimit.PersonaBytes;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const sizeOf = (draft: FileDraft): number => (draft.kind === "Stored" ? draft.sizeBytes : draft.bytes.byteLength);

const changed = (text: string): FileDraft => {
  const bytes = new Uint8Array(encoder.encode(text));
  return { kind: "Changed", bytes, text };
};

const storedDrafts = (persona: Persona | null): Drafts =>
  Object.fromEntries(
    (persona?.files ?? []).map((file) => [
      file.path,
      { kind: "Stored", digest: file.digest, sizeBytes: file.sizeBytes } satisfies FileDraft,
    ]),
  );

const writeFile = async (
  api: TumpelApi,
  path: string,
  draft: FileDraft,
  onUpload: (upload: Upload) => void,
): Promise<PersonaFileWrite> => {
  if (draft.kind === "Stored") {
    return { source: "Stored", path, digest: draft.digest, sizeBytes: draft.sizeBytes };
  }
  if (draft.bytes.byteLength <= INLINE_FILE_BYTES) {
    return { source: "Inline", path, content: draft.bytes.toBase64() };
  }
  onUpload({ path, sizeBytes: draft.bytes.byteLength });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", draft.bytes)).toHex();
  const upload = await api.uploadPersonaFile(digest, draft.bytes.byteLength);
  await api.putPersonaFile(upload, path, draft.bytes);
  return { source: "Stored", path, digest, sizeBytes: draft.bytes.byteLength };
};

const FileMeter = ({ total }: { total: number }) => {
  const over = total > PERSONA_BYTES;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">Files</span>
        <span className={cn(over && "font-semibold text-destructive")}>
          {formatKib(total)} of {formatKib(PERSONA_BYTES)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className={cn("h-1.5 rounded-full", over ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.min(100, (total / PERSONA_BYTES) * 100)}%` }}
        />
      </div>
    </div>
  );
};

const fileStatus = (draft: FileDraft | undefined, upload: Upload | null, path: string, tooLarge: boolean): string => {
  if (draft === undefined) return "Not set";
  if (upload !== null && upload.path === path) return `${formatKib(sizeOf(draft))}, Uploading`;
  if (tooLarge) return `${formatKib(sizeOf(draft))}, Too large`;
  if (draft.kind === "Stored") return `${formatKib(draft.sizeBytes)}, Stored`;
  return `${formatKib(draft.bytes.byteLength)}, Changed`;
};

const FileEditor = ({
  path,
  draft,
  upload,
  onChange,
  onClear,
}: {
  path: string;
  draft: FileDraft | undefined;
  upload: Upload | null;
  onChange: (draft: FileDraft | undefined) => void;
  onClear: () => void;
}) => {
  const editorId = useId();
  const picker = useRef<HTMLInputElement>(null);
  if (upload !== null) {
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-2 rounded-md border bg-card p-4 text-sm"
        aria-live="polite"
      >
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        Uploading {upload.path}, {formatKib(upload.sizeBytes)}...
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <label htmlFor={editorId} className="font-mono text-xs font-semibold">
        {path}
      </label>
      {draft?.kind === "Stored" && (
        <p className="text-xs text-muted-foreground">
          Stored, {formatKib(draft.sizeBytes)}, sha256 <span className="font-mono">{draft.digest.slice(0, 12)}</span>.
          The API does not return a stored file's contents. Type below or upload a file to replace it.
        </p>
      )}
      <textarea
        id={editorId}
        className="min-h-64 w-full rounded-md border bg-input p-3 font-mono text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={draft?.kind === "Changed" ? draft.text : ""}
        placeholder={draft?.kind === "Stored" ? "Type to replace the stored file" : "Type the file, or upload one"}
        onChange={(event) => onChange(event.target.value === "" ? undefined : changed(event.target.value))}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <input
          ref={picker}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file === undefined) return;
            void file.arrayBuffer().then((buffer) => {
              const bytes = new Uint8Array(buffer);
              onChange({ kind: "Changed", bytes, text: decoder.decode(bytes) });
            });
          }}
        />
        <Button variant="outline" size="sm" onClick={() => picker.current?.click()}>
          Upload file
        </Button>
        <Button variant="outline" size="sm" disabled={draft === undefined} onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
};

const DeletePersonaDialog = ({ tenantId, persona }: { tenantId: string; persona: Persona }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dialog = useHashDialog();
  const remove = useMutation({
    mutationFn: () => api.deletePersona(persona.personaId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.persona(tenantId, persona.personaId) });
      void queryClient.invalidateQueries({ queryKey: keys.personas(tenantId) });
      toast(`${persona.name} deleted.`);
      void navigate({ to: "/t/$tenantId/personas", params: { tenantId } });
    },
  });
  return (
    <ConfirmDialog
      open={dialog.isOpen("delete")}
      onClose={dialog.close}
      title={`Delete ${persona.name}?`}
      description="The persona and its files go. A persona that sessions ran on cannot be deleted; edit it instead."
      cancelLabel="Cancel"
      confirmLabel="Delete persona"
      pendingLabel="Deleting..."
      destructive
      confirmDisabled={false}
      mutation={remove}
      refusalActions={null}
      onConfirm={() => remove.mutate()}
    />
  );
};

const HarnessChangeDialog = ({
  change,
  onConfirm,
  onCancel,
}: {
  change: { harness: Harness; dropped: string[] };
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <ConfirmDialog
    open
    onClose={onCancel}
    title={`Switch to ${HARNESS_LABELS[change.harness]}?`}
    description={`${HARNESS_LABELS[change.harness]} reads no file at ${change.dropped.join(", ")}. Switching clears ${change.dropped.length === 1 ? "it" : "them"}.`}
    cancelLabel={`Keep ${change.dropped.length === 1 ? "the file" : "the files"}`}
    confirmLabel="Switch and clear"
    pendingLabel="Switch and clear"
    destructive
    confirmDisabled={false}
    mutation={null}
    refusalActions={null}
    onConfirm={onConfirm}
  />
);

const catalogEntryOf = (
  catalog: readonly HarnessCatalogEntry[],
  versions: readonly EffectiveHarnessVersion[],
  harness: Harness,
): HarnessCatalogEntry | undefined => {
  const runs = versions.find((version) => version.harness === harness)?.harnessVersion;
  return catalog.find((entry) => entry.harness === harness && entry.harnessVersion === runs);
};

const PersonaEditor = ({
  tenantId,
  persona,
  catalog,
  versions,
  secretSets,
  initialHarness,
  openFile,
}: {
  tenantId: string;
  persona: Persona | null;
  catalog: HarnessCatalogEntry[];
  versions: EffectiveHarnessVersion[];
  secretSets: SecretSet[];
  initialHarness: Harness;
  openFile: string | undefined;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const ids = { name: useId(), harness: useId(), secretSet: useId() };
  const [name, setName] = useState(persona?.name ?? "");
  const [harness, setHarness] = useState<Harness>(persona?.harness ?? initialHarness);
  const [secretSetId, setSecretSetId] = useState(persona?.secretSetId ?? secretSets[0]?.secretSetId ?? "");
  const [drafts, setDrafts] = useState<Drafts>(() => storedDrafts(persona));
  const [dirty, setDirty] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [harnessChange, setHarnessChange] = useState<{ harness: Harness; dropped: string[] } | null>(null);
  const guard = useUnsavedGuard(dirty);

  const entry = catalogEntryOf(catalog, versions, harness);
  const catalogPaths = entry?.personaFilePaths ?? [];
  const paths = [...catalogPaths, ...Object.keys(drafts).filter((path) => !catalogPaths.includes(path))];
  const selected = openFile !== undefined && paths.includes(openFile) ? openFile : paths[0];
  const total = Object.values(drafts).reduce((sum, draft) => sum + sizeOf(draft), 0);
  const tooBig = total > PERSONA_BYTES;
  const largest = Object.entries(drafts).sort(([, left], [, right]) => sizeOf(right) - sizeOf(left))[0]?.[0];
  const outsideCatalog = Object.keys(drafts).filter((path) => !catalogPaths.includes(path));
  const missing = [name.trim() === "" ? "a name" : null, secretSetId === "" ? "a secret set" : null].filter(
    (item) => item !== null,
  );

  const edit = (apply: () => void) => {
    apply();
    setDirty(true);
    save.reset();
  };
  const selectFile = (path: string) =>
    void navigate({ to: ".", search: (search) => ({ ...search, file: [path] }), replace: true });
  const setDraft = (path: string, draft: FileDraft | undefined) =>
    edit(() =>
      setDrafts((current) => {
        const { [path]: _, ...rest } = current;
        return draft === undefined ? rest : { ...rest, [path]: draft };
      }),
    );
  const switchHarness = (next: Harness) => {
    const nextPaths = catalogEntryOf(catalog, versions, next)?.personaFilePaths ?? [];
    edit(() => {
      setHarness(next);
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([path]) => nextPaths.includes(path))));
    });
    setHarnessChange(null);
  };
  const askHarness = (next: Harness) => {
    const nextPaths = catalogEntryOf(catalog, versions, next)?.personaFilePaths ?? [];
    const dropped = Object.keys(drafts).filter((path) => !nextPaths.includes(path));
    if (dropped.length === 0) switchHarness(next);
    else setHarnessChange({ harness: next, dropped });
  };

  const save = useMutation({
    mutationFn: async (): Promise<Persona> => {
      const files: PersonaFileWrite[] = [];
      for (const [path, draft] of Object.entries(drafts)) files.push(await writeFile(api, path, draft, setUpload));
      setUpload(null);
      const fields = { name: name.trim(), secretSetId, files };
      if (persona === null) return api.createPersona({ ...fields, harness, connectorIds: [] });
      return api.updatePersona(persona.personaId, { ...fields, connectorIds: persona.connectorIds });
    },
    onSettled: () => setUpload(null),
    onSuccess: (saved) => {
      guard.release();
      queryClient.setQueryData(keys.persona(tenantId, saved.personaId), saved);
      void queryClient.invalidateQueries({ queryKey: keys.personas(tenantId) });
      toast(persona === null ? `${saved.name} created.` : `${saved.name} saved.`);
      void navigate({
        to: "/t/$tenantId/personas/$personaId",
        params: { tenantId, personaId: saved.personaId },
        search: { file: [] },
        replace: persona !== null,
      });
    },
  });
  const transient = save.isError && failureOf(save.error).kind !== "Problem";
  const busy = save.isPending;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="grid content-start gap-4">
          <Field id={ids.name} label="Name" error={null} hint={null}>
            <Input id={ids.name} value={name} onChange={(event) => edit(() => setName(event.target.value))} />
          </Field>
          <Field
            id={ids.harness}
            label="Harness"
            error={null}
            hint={persona === null ? null : "Fixed when the persona was created."}
          >
            <NativeSelect
              id={ids.harness}
              value={harness}
              disabled={persona !== null}
              onChange={(event) => {
                const next = catalog.find((item) => item.harness === event.target.value)?.harness;
                if (next !== undefined) askHarness(next);
              }}
            >
              {[...new Set(catalog.map((item) => item.harness))].map((item) => (
                <option key={item} value={item}>
                  {HARNESS_LABELS[item]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id={ids.secretSet}
            label="Secret set"
            error={null}
            hint={secretSets.length === 0 ? "No secret set yet. Create one under Secret sets first." : null}
          >
            <NativeSelect
              id={ids.secretSet}
              value={secretSetId}
              onChange={(event) => edit(() => setSecretSetId(event.target.value))}
            >
              {secretSets.map((set) => (
                <option key={set.secretSetId} value={set.secretSetId}>
                  {set.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid content-start gap-3">
          <FileMeter total={total} />
          <div className="grid gap-3 md:grid-cols-[13rem_1fr]">
            <div className="grid content-start gap-2">
              <ul className="grid gap-1.5" aria-label="Persona files">
                {paths.map((path) => {
                  const draft = drafts[path];
                  const marked = tooBig && path === largest;
                  return (
                    <li key={path}>
                      <button
                        type="button"
                        aria-current={path === selected}
                        onClick={() => selectFile(path)}
                        className={cn(
                          "grid w-full rounded-md border bg-card px-3 py-1.5 text-left",
                          path === selected && "border-primary bg-accent",
                          marked && "border-2 border-destructive",
                        )}
                      >
                        <span className="truncate font-mono text-xs font-semibold">{path}</span>
                        <span className={cn("text-[11px] text-muted-foreground", marked && "font-semibold")}>
                          {catalogPaths.includes(path)
                            ? fileStatus(draft, upload, path, marked)
                            : "Not in the catalog; clear it"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                {entry === undefined
                  ? `The catalog lists no version of ${HARNESS_LABELS[harness]}.`
                  : catalogPaths.length === 0
                    ? `${HARNESS_LABELS[harness]} ${entry.harnessVersion} reads no persona files.`
                    : `Paths come from the catalog for ${HARNESS_LABELS[harness]} ${entry.harnessVersion}.`}
              </p>
            </div>
            {selected !== undefined && (
              <FileEditor
                key={selected}
                path={selected}
                draft={drafts[selected]}
                upload={upload}
                onChange={(draft) => setDraft(selected, draft)}
                onClear={() => setDraft(selected, undefined)}
              />
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {tooBig && (
          <ProblemCard
            wording={{
              title: "Files over the persona limit",
              detail: `The files hold ${formatKib(total)} together. A persona holds at most ${formatKib(PERSONA_BYTES)}. Nothing was uploaded.`,
              fix: `Shorten ${largest ?? "a file"} or remove a file, then save.`,
            }}
          />
        )}
        {outsideCatalog.length > 0 && !tooBig && (
          <ProblemCard
            wording={{
              title: "Files the harness does not read",
              detail: `${HARNESS_LABELS[harness]} reads no file at ${outsideCatalog.join(", ")}. The API refuses a persona with one.`,
              fix: "Clear those files, then save.",
            }}
          />
        )}
        {save.isError && <ProblemBlock error={save.error} onRetry={transient ? () => save.mutate() : undefined} />}
        {missing.length > 0 && dirty && (
          <p className="text-sm text-muted-foreground">Save needs {missing.join(", ")}.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy || tooBig || outsideCatalog.length > 0 || missing.length > 0}
            onClick={() => save.mutate()}
          >
            {busy ? "Saving..." : persona === null ? "Create persona" : "Save"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/t/$tenantId/personas" params={{ tenantId }}>
              Cancel
            </Link>
          </Button>
          <div className="flex-1" />
          {persona !== null && (
            <Button variant="destructive" asChild>
              <Link to="." hash="delete" search={(search) => search}>
                Delete persona
              </Link>
            </Button>
          )}
        </div>
      </div>
      {harnessChange !== null && (
        <HarnessChangeDialog
          change={harnessChange}
          onConfirm={() => switchHarness(harnessChange.harness)}
          onCancel={() => setHarnessChange(null)}
        />
      )}
      {persona !== null && <DeletePersonaDialog tenantId={tenantId} persona={persona} />}
      {guard.dialog}
    </>
  );
};

const PersonaFrame = ({ tenantId, title, children }: { tenantId: string; title: string; children: ReactNode }) => (
  <>
    <PageHeader
      title={title}
      crumb={
        <Link to="/t/$tenantId/personas" params={{ tenantId }} className="hover:underline">
          Personas /
        </Link>
      }
    />
    {children}
  </>
);

const PersonaPage = ({
  tenantId,
  title,
  persona,
  initialHarness,
  openFile,
}: {
  tenantId: string;
  title: string;
  persona: Persona | null;
  initialHarness: Harness | undefined;
  openFile: string | undefined;
}) => {
  const catalog = useHarnessCatalog(tenantId);
  const versions = useHarnessPins(tenantId);
  const secretSets = useSecretSets(tenantId);
  const body = (): ReactNode => {
    if (catalog.isError) return <ProblemBlock error={catalog.error} onRetry={() => void catalog.refetch()} />;
    if (versions.isError) return <ProblemBlock error={versions.error} onRetry={() => void versions.refetch()} />;
    if (secretSets.isError) {
      return <ProblemBlock error={secretSets.error} onRetry={() => void secretSets.refetch()} />;
    }
    if (catalog.isPending || versions.isPending || secretSets.isPending) return <Skeleton className="h-96 w-full" />;
    const firstHarness = initialHarness ?? catalog.data[0]?.harness;
    if (firstHarness === undefined) {
      return (
        <ProblemCard
          wording={{
            title: "The harness catalog is empty",
            detail: "HarnessCatalog_list answered no harness, so a persona has nothing to run.",
            fix: "Report it; the control plane ships with a catalog.",
          }}
        />
      );
    }
    return (
      <PersonaEditor
        key={`${persona?.personaId ?? "new"}-${persona?.updatedAt ?? 0}`}
        tenantId={tenantId}
        persona={persona}
        catalog={catalog.data}
        versions={versions.data}
        secretSets={secretSets.data}
        initialHarness={firstHarness}
        openFile={openFile}
      />
    );
  };
  return (
    <PersonaFrame tenantId={tenantId} title={persona?.name ?? title}>
      {body()}
    </PersonaFrame>
  );
};

export const NewPersonaScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/personas/new" });
  const { harness, file } = useSearch({ from: "/t/$tenantId/personas/new" });
  return (
    <PersonaPage
      tenantId={tenantId}
      title="New persona"
      persona={null}
      initialHarness={harness[0]}
      openFile={file[0]}
    />
  );
};

export const PersonaScreen = () => {
  const { tenantId, personaId } = useParams({ from: "/t/$tenantId/personas/$personaId" });
  const { file } = useSearch({ from: "/t/$tenantId/personas/$personaId" });
  const persona = usePersona(tenantId, personaId);
  if (persona.isError) {
    return (
      <PersonaFrame tenantId={tenantId} title="Persona">
        <ProblemBlock error={persona.error} onRetry={() => void persona.refetch()} />
      </PersonaFrame>
    );
  }
  if (persona.isPending) {
    return (
      <PersonaFrame tenantId={tenantId} title="Persona">
        <Skeleton className="h-96 w-full" />
      </PersonaFrame>
    );
  }
  return (
    <PersonaPage
      tenantId={tenantId}
      title="Persona"
      persona={persona.data}
      initialHarness={undefined}
      openFile={file[0]}
    />
  );
};
