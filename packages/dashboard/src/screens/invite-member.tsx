import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { failureOf, type InvitationCreate, type InvitationCreated, type Role } from "../api/port";
import { CopyButton } from "../components/copy-value";
import { Field } from "../components/field";
import { ProblemBlock } from "../components/problem-block";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { useTenantApi } from "../context";
import { formatTime } from "../fleet";
import { cn } from "../lib";
import { memberKeys } from "../queries";

const ROLES: ReadonlyArray<{ role: Role; hint: string }> = [
  { role: "Member", hint: "Runs sessions, hosts, personas and secret sets." },
  { role: "Owner", hint: "Also manages members and connections." },
];

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

const fieldRefusal = (error: Error | null): string | null => {
  if (error === null) return null;
  const failure = failureOf(error);
  if (failure.kind !== "Problem" || (failure.status !== 400 && failure.status !== 409)) return null;
  return `${sentence(failure.problem.detail)} ${sentence(failure.problem.fix)}`;
};

const InviteLink = ({ created, onDone }: { created: InvitationCreated; onDone: () => void }) => (
  <>
    <DialogTitle>Invite link for {created.invitation.email}</DialogTitle>
    <p className="rounded-md border-2 border-foreground px-3 py-2 text-sm font-semibold">
      Shown once. No email is sent: copy the link now and send it to {created.invitation.email} yourself.
    </p>
    <div className="grid gap-2">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px] whitespace-pre-wrap break-all">
        {created.acceptUrl}
      </pre>
      <span className="justify-self-start">
        <CopyButton text={created.acceptUrl} label="Copy invite link" />
      </span>
    </div>
    <dl className="grid grid-cols-[6rem_1fr] gap-1 text-sm">
      <dt className="text-muted-foreground">Role</dt>
      <dd>{created.invitation.role}</dd>
      <dt className="text-muted-foreground">Expires</dt>
      <dd>{formatTime(Date.parse(created.invitation.expiresAt))}, seven days from now</dd>
    </dl>
    <DialogDescription>
      The link works once, for {created.invitation.email} signed in to Cloudflare Access. It stays under Open invites
      until it is accepted, revoked or expires.
    </DialogDescription>
    <DialogFooter>
      <Button onClick={onDone}>Done</Button>
    </DialogFooter>
  </>
);

export const InviteMemberDialog = ({
  tenantId,
  tenantName,
  initialRole,
  onClose,
}: {
  tenantId: string;
  tenantName: string;
  initialRole: Role;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const invite = useMutation({
    mutationFn: (body: InvitationCreate) => api.createInvitation(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: memberKeys.invitations(tenantId) }),
  });
  const refusal = fieldRefusal(invite.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate({ email: email.trim(), role });
  };
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {invite.isSuccess ? (
          <InviteLink created={invite.data} onDone={onClose} />
        ) : (
          <form className="grid gap-4" onSubmit={submit} noValidate>
            <DialogTitle>Invite to {tenantName}</DialogTitle>
            <Field
              id="invite-email"
              label="Email"
              error={refusal}
              hint="They sign in with Cloudflare Access using this email."
            >
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                autoFocus
                required
                value={email}
                aria-invalid={refusal !== null}
                aria-describedby={refusal === null ? undefined : "invite-email-error"}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (invite.isError) invite.reset();
                }}
              />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Role</legend>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((option) => (
                  <label
                    key={option.role}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      role === option.role ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      className="sr-only"
                      checked={role === option.role}
                      onChange={() => setRole(option.role)}
                    />
                    {option.role}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{ROLES.find((option) => option.role === role)?.hint}</p>
            </fieldset>
            {invite.isError && refusal === null && (
              <ProblemBlock error={invite.error} onRetry={() => invite.mutate({ email: email.trim(), role })} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending || email.trim() === ""}>
                {invite.isPending ? "Inviting..." : "Create invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
