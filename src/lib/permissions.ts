import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements as orgDefaultStatements,
} from "better-auth/plugins/organization/access";
import {
  defaultStatements as platformDefaultStatements,
  adminAc as platformAdminAc,
} from "better-auth/plugins/admin/access";

/* ---------- Platform roles (user.role, admin plugin) ---------- */

export const platformAc = createAccessControl(platformDefaultStatements);

export const platformRoles = {
  superadmin: platformAc.newRole(platformAdminAc.statements),
  user: platformAc.newRole({ user: [], session: [] }),
};

/* ---------- Clinic roles (member.role, organization plugin) ---------- */

// Only what exists today: the clinic itself, its staff and its invitations
// (Better Auth's built-in organization features; teams and dynamic access
// control aren't used).
// When you build a feature (patients, agenda, clinical notes...), add its
// statement here, e.g. `patient: ["create", "read", "update", "delete"]`,
// give each role its actions below, and check them in the feature's endpoints
// with auth.api.hasPermission.
const clinicStatements = {
  organization: orgDefaultStatements.organization,
  member: orgDefaultStatements.member,
  invitation: orgDefaultStatements.invitation,
} as const;

export const clinicAc = createAccessControl(clinicStatements);

export const clinicRoles = {
  owner: clinicAc.newRole({
    organization: ["update"], // deleting a clinic is super-admin only
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  admin: clinicAc.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  // No clinic-management rights. Their permissions will come with the features
  // they use (agenda, patients...)
  receptionist: clinicAc.newRole({ organization: [], member: [], invitation: [] }),
  physio: clinicAc.newRole({ organization: [], member: [], invitation: [] }),
};

export type ClinicRole = keyof typeof clinicRoles;

export const CLINIC_ROLES = Object.keys(clinicRoles) as ClinicRole[];

// Exactly one of the clinic roles above. Better Auth's database default for a
// member's role is "member" (not ours, so it would have no permissions) and it
// also accepts lists like "admin,physio"; neither is allowed here
export const isClinicRole = (role: unknown): role is ClinicRole =>
  typeof role === "string" && (CLINIC_ROLES as string[]).includes(role);
