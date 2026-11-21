import type { Device, Invitation, Member, Membership, TumpelApi } from "../api/port";

export type MemberOperation =
  | "listTenants"
  | "listDevices"
  | "revokeDevice"
  | "listMembers"
  | "removeMember"
  | "listInvitations"
  | "createInvitation"
  | "revokeInvitation";

const TENANT_ID = "tnt_placeholder01";
const CREATED = Date.parse("2026-11-15T14:02:11+01:00");

const tenant = (tenantId: string, name: string) => ({ tenantId, name, tier: "Free" as const, createdAt: CREATED, updatedAt: CREATED });

export const MEMBERSHIPS: Membership[] = [
  { tenant: tenant(TENANT_ID, "Tenant name"), role: "Owner", createdAt: Date.parse("2026-10-02T09:00:00+02:00") },
  {
    tenant: tenant("tnt_placeholder02", "Second tenant"),
    role: "Member",
    createdAt: Date.parse("2026-10-20T09:00:00+02:00"),
  },
  {
    tenant: tenant("tnt_placeholder03", "Third tenant"),
    role: "Member",
    createdAt: Date.parse("2026-11-03T09:00:00+01:00"),
  },
];

const member = (principalId: string, email: string, role: Member["role"], created: string): Member => ({
  principalId,
  tenantId: TENANT_ID,
  email,
  role,
  createdAt: Date.parse(created),
  updatedAt: Date.parse(created),
});

export const MEMBERS: Member[] = [
  member("prn_placeholder01", "user@example.com", "Owner", "2026-10-02T09:00:00+02:00"),
  member("prn_placeholder02", "second-owner@example.com", "Owner", "2026-10-20T09:00:00+02:00"),
  member("prn_placeholder03", "member@example.com", "Member", "2026-11-03T09:00:00+01:00"),
];

export const SOLE_OWNER: Member[] = [MEMBERS[0], MEMBERS[2]].filter((item): item is Member => item !== undefined);

export const INVITATIONS: Invitation[] = [
  {
    invitationId: "inv_placeholder01",
    tenantId: TENANT_ID,
    principalId: "prn_placeholder01",
    email: "new-person@example.com",
    role: "Member",
    expiresAt: "2026-11-21T14:02:11+01:00",
    createdAt: Date.parse("2026-11-14T14:02:11+01:00"),
  },
];

const device = (deviceId: string, name: string, created: string, used: string): Device => ({
  deviceId,
  tenantId: TENANT_ID,
  principalId: "prn_placeholder01",
  name,
  createdAt: Date.parse(created),
  lastUsedAt: Date.parse(used),
});

export const DEVICES: Device[] = [
  device("dev_placeholder01", "work laptop", "2026-10-02T09:10:00+02:00", "2026-11-15T13:40:00+01:00"),
  device("dev_placeholder02", "build box", "2026-11-03T11:00:00+01:00", "2026-11-12T08:05:00+01:00"),
];

export const memberFakes = (): Pick<TumpelApi, MemberOperation> => ({
  listTenants: async () => MEMBERSHIPS,
  listDevices: async () => DEVICES,
  revokeDevice: async () => undefined,
  listMembers: async () => MEMBERS,
  removeMember: async () => undefined,
  listInvitations: async () => INVITATIONS,
  createInvitation: async (created) => ({
    invitation: {
      invitationId: "inv_placeholder09",
      tenantId: TENANT_ID,
      principalId: "prn_placeholder01",
      email: created.email,
      role: created.role,
      expiresAt: "2026-11-22T14:02:11+01:00",
      createdAt: CREATED,
    },
    acceptUrl: "https://api.example.com/invitations/accept?token=INVITE_TOKEN_SHOWN_ONCE",
  }),
  revokeInvitation: async () => undefined,
});
