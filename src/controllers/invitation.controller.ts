import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { invitation, organization, user } from "../db/schema.js";

// Public: what the accept-invitation page needs before anyone logs in.
// The invitation id is a long random secret (it's in the emailed link), and only
// the minimum is returned: no ids of people, no inviter details.
export const getPublicInvitation = async (
  req: Request<{ invitationId: string }>,
  res: Response,
) => {
  const { invitationId } = req.params;

  const [found] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      clinicName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!found) {
    res.status(404).json({
      error: { code: "INVITATION_NOT_FOUND", message: "La invitación no existe" },
    });
    return;
  }

  // Lets the page offer "create account" or "log in"
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, found.email))
    .limit(1);

  res.json({
    invitation: {
      id: found.id,
      email: found.email,
      role: found.role,
      status: found.status,
      expired: found.expiresAt < new Date(),
      clinicName: found.clinicName,
      hasAccount: !!existingUser,
    },
  });
};
