import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { invitation, member, user } from "../db/schema.js";

// Invitation fields sent to the frontend
export const invitationColumns = {
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
};

// member → user: who belongs to a clinic and with which role
export async function getClinicMembers(clinicId: string) {
  return db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, clinicId))
    .orderBy(asc(member.createdAt));
}

// Invitations not yet accepted (expired ones included, so they can be resent)
export async function getPendingInvitations(clinicId: string) {
  return db
    .select(invitationColumns)
    .from(invitation)
    .where(and(eq(invitation.organizationId, clinicId), eq(invitation.status, "pending")))
    .orderBy(asc(invitation.createdAt));
}
