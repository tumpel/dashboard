import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { MintedEnrolmentToken } from "../api/port";
import { CopyButton } from "../components/copy-value";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { useTenantApi } from "../context";
import { formatTime } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { cn } from "../lib";
import { keys } from "../queries";

const EXPIRIES = [
  { seconds: 600, label: "10 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "24 hours" },
] as const;

export const installWithToken = ({ token, installCommand }: MintedEnrolmentToken): string =>
  `printf '%s' '${token}' | (${installCommand})`;

const TokenShown = ({
  minted,
  onCheck,
  onDone,
}: {
  minted: MintedEnrolmentToken;
  onCheck: () => void;
  onDone: () => void;
}) => {
  const command = installWithToken(minted);
  return (
    <>
      <DialogTitle>Run this on the new host</DialogTitle>
      <p className="rounded-md border-2 border-foreground px-3 py-2 text-sm font-semibold">
        Shown once. Copy it now: closing this dialog discards it.
      </p>
      <div className="grid gap-2">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px] whitespace-pre-wrap break-all">
          {command}
        </pre>
        <span className="justify-self-start">
          <CopyButton text={command} label="Copy command" />
        </span>
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-1 text-sm">
        <dt className="text-muted-foreground">Expires</dt>
        <dd>{formatTime(Date.parse(minted.enrolmentToken.expiresAt))}</dd>
        <dt className="text-muted-foreground">Token</dt>
        <dd>{minted.enrolmentToken.state}</dd>
      </dl>
      <DialogDescription>
        The host appears in the list once it enrols. The list re-reads when you return to this window, or on Check now.
      </DialogDescription>
      <DialogFooter>
        <Button variant="outline" onClick={onCheck}>
          Check now
        </Button>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
};

export const EnrolHostDialog = ({ tenantId }: { tenantId: string }) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const dialog = useHashDialog();
  const [expiry, setExpiry] = useState<number>(3600);
  const [discarding, setDiscarding] = useState(false);
  const mint = useMutation({ mutationFn: (seconds: number) => api.mintEnrolmentToken(seconds) });
  const refreshHosts = () => void queryClient.invalidateQueries({ queryKey: keys.hosts(tenantId) });
  const close = () => {
    mint.reset();
    setDiscarding(false);
    refreshHosts();
    dialog.close();
  };
  const onOpenChange = (next: boolean) => {
    if (next) return;
    if (mint.isSuccess && !discarding) {
      setDiscarding(true);
      return;
    }
    close();
  };
  return (
    <Dialog open={dialog.isOpen("enrol")} onOpenChange={onOpenChange}>
      <DialogContent>
        {mint.isSuccess ? (
          <>
            <TokenShown minted={mint.data} onCheck={refreshHosts} onDone={close} />
            {discarding && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <span className="flex-1">Close and discard the token? It is never shown again.</span>
                <Button size="sm" variant="outline" onClick={() => setDiscarding(false)}>
                  Keep it
                </Button>
                <Button size="sm" variant="destructive" onClick={close}>
                  Discard
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <DialogTitle>Enrol a host</DialogTitle>
            <DialogDescription>
              Mint a one-time token. The command it gives downloads the x86_64 (Amd64) supervisor, installs it and
              enrols the host: run it on a Linux machine with KVM as a user who can use sudo.
            </DialogDescription>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">Token expires in</legend>
              <div className="flex flex-wrap gap-2">
                {EXPIRIES.map(({ seconds, label }) => (
                  <label
                    key={seconds}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      expiry === seconds ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    <input
                      type="radio"
                      name="expiry"
                      className="sr-only"
                      checked={expiry === seconds}
                      onChange={() => setExpiry(seconds)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">One token enrols one host. It is shown once.</p>
            </fieldset>
            {mint.isError && <ProblemBlock error={mint.error} onRetry={() => mint.mutate(expiry)} />}
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button disabled={mint.isPending} onClick={() => mint.mutate(expiry)}>
                {mint.isPending ? "Minting..." : "Mint token"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
