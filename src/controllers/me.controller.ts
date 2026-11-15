import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { member, organization } from "../db/schema.js";
import { getClinicFeatures } from "../lib/features.js";

export const getMe = async (req: Request, res: Response) => {
  const user = req.user!;
  const session = req.session!;

  const memberships = await db
    .select({
      clinicId: organization.id,
      clinicName: organization.name,
      clinicSlug: organization.slug,
      clinicStatus: organization.status,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, user.id));

  const activeClinicId = session.activeOrganizationId ?? null;
  const activeMembership = memberships.find((m) => m.clinicId === activeClinicId);

  res.json({
    user: { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role },
    memberships,
    // With the optional features a super-admin switched on for this clinic
    activeClinic: activeMembership
      ? { ...activeMembership, features: await getClinicFeatures(activeMembership.clinicId) }
      : null,
  });
};
