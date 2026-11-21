import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { failureOf, type Invitation, type Member, type Role } from "../api/port";
import { ConfirmDialog } from "../components/confirm-dialog";
import { PageHeader } from "../components/page-header";
import { ProblemBlock } from "../components/problem-block";
import { RoleBadge } from "../components/role-badge";
import { TableSkeleton } from "../components/table-skeleton";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useTenantApi } from "../context";
import { formatDate, formatTime } from "../fleet";
import { useHashDialog } from "../hash-dialog";
import { memberKeys, useInvitations, useMembers, useOwner, useWhoami } from "../queries";
import { InviteMemberDialog } from "./invite-member";

const isLastOwner = (error: Error | null): boolean => {
  if (error === null) return false;
  const failure = failureOf(error);
  return failure.kind === "Problem" && failure.problem.code === "LastOwner";
};

const RemoveMemberDialog = ({
  tenantId,
  member,
  you,
  onClose,
  onInviteOwner,
}: {
  tenantId: string;
  member: Member;
  you: boolean;
  onClose: () => void;
  onInviteOwner: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.removeMember(member.principalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.members(tenantId) });
      toast(`${member.email} removed. Their devices here are signed out.`);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Remove ${member.email}?`}
      description={
        <>
          <p>They leave this tenant, and every device and token they signed in here is signed out at once.</p>
          {you && <p className="font-semibold">That is you: this browser is signed out of this tenant too.</p>}
        </>
      }
      cancelLabel="Cancel"
      confirmLabel="Remove"
      pendingLabel="Removing..."
      destructive
      confirmDisabled={false}
      mutation={remove}
      refusalActions={
        isLastOwner(remove.error) ? (
          <Button size="sm" onClick={onInviteOwner}>
            Invite an Owner
          </Button>
        ) : null
      }
      onConfirm={() => remove.mutate()}
    />
  );
};

const RevokeInvitationDialog = ({
  tenantId,
  invitation,
  onClose,
}: {
  tenantId: string;
  invitation: Invitation;
  onClose: () => void;
}) => {
  const api = useTenantApi(tenantId);
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => api.revokeInvitation(invitation.invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.invitations(tenantId) });
      toast(`Invite for ${invitation.email} revoked.`);
      onClose();
    },
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Revoke the invite for ${invitation.email}?`}
      description="Its link stops working at once. Invite them again to send a new one."
      cancelLabel="Cancel"
      confirmLabel="Revoke invite"
      pendingLabel="Revoking..."
      destructive
      confirmDisabled={false}
      mutation={revoke}
      refusalActions={null}
      onConfirm={() => revoke.mutate()}
    />
  );
};

const MemberRows = ({
  members,
  yourId,
  owner,
  onRemove,
}: {
  members: Member[];
  yourId: string;
  owner: boolean;
  onRemove: (member: Member) => void;
}) => (
  <Table mobile>
    <TableHeader>
      <TableRow>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
        {owner && <TableHead className="text-right">Actions</TableHead>}
      </TableRow>
    </TableHeader>
    <TableBody>
      {members.map((member) => (
        <TableRow key={member.principalId}>
          <TableCell mobile="primary" className="font-medium">
            {member.email}
            {member.principalId === yourId && <span className="text-muted-foreground"> (you)</span>}
          </TableCell>
          <TableCell mobile="state">
            <RoleBadge role={member.role} />
          </TableCell>
          {owner && (
            <TableCell mobile="action" className="text-right">
              <Button size="sm" variant="outline" onClick={() => onRemove(member)}>
                Remove
              </Button>
            </TableCell>
          )}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const InvitationRows = ({
  invitations,
  owner,
  onRevoke,
}: {
  invitations: Invitation[];
  owner: boolean;
  onRevoke: (invitation: Invitation) => void;
}) => (
  <Table mobile>
    <TableHeader>
      <TableRow>
        <TableHead>Invited email</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Invited</TableHead>
        <TableHead>Expires</TableHead>
        {owner && <TableHead className="text-right">Actions</TableHead>}
      </TableRow>
    </TableHeader>
    <TableBody>
      {invitations.map((invitation) => (
        <TableRow key={invitation.invitationId}>
          <TableCell mobile="primary" className="font-medium">
            {invitation.email}
          </TableCell>
          <TableCell mobile="state">
            <RoleBadge role={invitation.role} />
          </TableCell>
          <TableCell label="Invited">{formatDate(invitation.createdAt)}</TableCell>
          <TableCell label="Expires">{formatTime(Date.parse(invitation.expiresAt))}</TableCell>
          {owner && (
            <TableCell mobile="action" className="text-right">
              <Button size="sm" variant="outline" onClick={() => onRevoke(invitation)}>
                Revoke
              </Button>
            </TableCell>
          )}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const MembersScreen = () => {
  const { tenantId } = useParams({ from: "/t/$tenantId/members" });
  const navigate = useNavigate();
  const dialog = useHashDialog();
  const whoami = useWhoami(tenantId);
  const members = useMembers(tenantId);
  const invitations = useInvitations(tenantId);
  const [inviteRole, setInviteRole] = useState<Role>("Member");
  const [removing, setRemoving] = useState<Member | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const owner = useOwner(tenantId);
  const yourId = whoami.data?.principal.principalId ?? "";
  const tenantName = whoami.data?.tenant.name ?? tenantId;
  const openInvite = (role: Role) => {
    setInviteRole(role);
    void navigate({ to: ".", hash: "invite", search: (search) => search });
  };

  const memberList = () => {
    if (members.isPending) return <TableSkeleton rows={3} />;
    if (members.isError) return <ProblemBlock error={members.error} onRetry={() => void members.refetch()} />;
    return <MemberRows members={members.data} yourId={yourId} owner={owner} onRemove={setRemoving} />;
  };

  const invitationList = () => {
    if (invitations.isPending) return <TableSkeleton rows={1} />;
    if (invitations.isError) {
      return <ProblemBlock error={invitations.error} onRetry={() => void invitations.refetch()} />;
    }
    if (invitations.data.length === 0) return <p className="text-sm text-muted-foreground">No open invites.</p>;
    return <InvitationRows invitations={invitations.data} owner={owner} onRevoke={setRevoking} />;
  };

  return (
    <>
      <PageHeader
        title="Members"
        actions={owner && members.isSuccess ? <Button onClick={() => openInvite("Member")}>Invite</Button> : undefined}
      />
      <div className="grid gap-6">
        {memberList()}
        <section className="grid gap-3" aria-labelledby="open-invites">
          <h2 id="open-invites" className="font-semibold">
            Open invites
          </h2>
          {invitationList()}
          <p className="text-sm text-muted-foreground">
            An invite stays open until the person accepts it, an Owner revokes it, or it expires after seven days.
          </p>
          {whoami.isSuccess && !owner && (
            <p className="text-sm">Only an Owner invites and removes members. Owners are listed above.</p>
          )}
        </section>
      </div>
      {dialog.isOpen("invite") && (
        <InviteMemberDialog
          tenantId={tenantId}
          tenantName={tenantName}
          initialRole={inviteRole}
          onClose={dialog.close}
        />
      )}
      {removing !== null && (
        <RemoveMemberDialog
          tenantId={tenantId}
          member={removing}
          you={removing.principalId === yourId}
          onClose={() => setRemoving(null)}
          onInviteOwner={() => {
            setRemoving(null);
            openInvite("Owner");
          }}
        />
      )}
      {revoking !== null && (
        <RevokeInvitationDialog tenantId={tenantId} invitation={revoking} onClose={() => setRevoking(null)} />
      )}
    </>
  );
};
