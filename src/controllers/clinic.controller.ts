import type { Request, Response } from "express";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { generateId } from "better-auth";
import { db } from "../db/index.js";
import { invitation, member, organization, user } from "../db/schema.js";
import {
  getClinicMembers,
  getPendingInvitations,
  invitationColumns,
} from "../lib/clinicTeam.js";
import { invitationExpiryDate, sendInvitationEmail } from "../lib/invitations.js";
import { CLINIC_ROLES, isClinicRole } from "../lib/permissions.js";

const clinicColumns = {
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  logo: organization.logo,
  status: organization.status,
  isPublic: organization.isPublic,
  createdAt: organization.createdAt,
};

export const getAllClinics = async (_req: Request, res: Response) => {
  const clinics = await db
    .select(clinicColumns)
    .from(organization)
    .orderBy(asc(organization.name));

  res.json({ clinics });
};

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Super-admin only: creates the clinic with no members and invites its owner.
// The owner joins when they accept; the super-admin never becomes a member.
export const createClinic = async (req: Request, res: Response) => {
  const { name, slug, logo, ownerEmail } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({
      error: { code: "INVALID_NAME", message: "El nombre es obligatorio" },
    });
    return;
  }
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    res.status(400).json({
      error: {
        code: "INVALID_SLUG",
        message: "La URL solo puede tener minúsculas, números y guiones",
      },
    });
    return;
  }
  if (logo !== undefined && typeof logo !== "string") {
    res.status(400).json({
      error: { code: "INVALID_LOGO", message: "El logo debe ser una URL" },
    });
    return;
  }

  if (typeof ownerEmail !== "string" || !EMAIL_PATTERN.test(ownerEmail.trim())) {
    res.status(400).json({
      error: {
        code: "INVALID_OWNER_EMAIL",
        message: "El email del propietario no es válido",
      },
    });
    return;
  }

  try {
    const [taken] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);

    if (taken) {
      res.status(409).json({
        error: { code: "SLUG_TAKEN", message: "Ya existe una clínica con esa URL" },
      });
      return;
    }

    // Written directly instead of with Better Auth's createOrganization /
    // createInvitation: those require the creator to become a member, and only
    // an existing owner may invite another owner. Rows follow Better Auth's
    // format, so its normal accept-invitation flow works with them.
    const { clinic, ownerInvitation } = await db.transaction(async (tx) => {
      const [clinic] = await tx
        .insert(organization)
        .values({
          id: generateId(),
          name: name.trim(),
          slug,
          logo: logo?.trim() || null,
          createdAt: new Date(),
        })
        .returning(clinicColumns);

      const [ownerInvitation] = await tx
        .insert(invitation)
        .values({
          id: generateId(),
          organizationId: clinic!.id,
          // Better Auth compares emails in lowercase when accepting
          email: ownerEmail.trim().toLowerCase(),
          role: "owner",
          status: "pending",
          expiresAt: invitationExpiryDate(),
          inviterId: req.user!.id,
        })
        .returning(invitationColumns);

      return { clinic: clinic!, ownerInvitation: ownerInvitation! };
    });

    await sendInvitationEmail({
      invitationId: ownerInvitation.id,
      email: ownerInvitation.email,
      role: "owner",
      clinicName: clinic.name,
      inviterName: req.user!.name,
    });

    res.status(201).json({ clinic });
  } catch (error) {
    console.error("createClinic failed:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "No se pudo crear la clínica" },
    });
  }
};

export const getClinicById = async (
  req: Request<{ clinicId: string }>,
  res: Response,
) => {
  const { clinicId } = req.params;

  const [clinic] = await db
    .select(clinicColumns)
    .from(organization)
    .where(eq(organization.id, clinicId))
    .limit(1);

  if (!clinic) {
    res.status(404).json({
      error: { code: "CLINIC_NOT_FOUND", message: "La clínica no existe" },
    });
    return;
  }

  const [members, invitations] = await Promise.all([
    getClinicMembers(clinicId),
    getPendingInvitations(clinicId),
  ]);

  res.json({ clinic: { ...clinic, members, invitations } });
};

// Super-admin only: invite someone to a clinic, e.g. a new owner after the
// first invitation was cancelled
export const createInvitation = async (
  req: Request<{ clinicId: string }>,
  res: Response,
) => {
  const { clinicId } = req.params;
  const { email, role } = req.body ?? {};

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "El email no es válido" },
    });
    return;
  }
  if (!isClinicRole(role)) {
    res.status(400).json({
      error: {
        code: "INVALID_ROLE",
        message: `El rol debe ser uno de: ${CLINIC_ROLES.join(", ")}`,
      },
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [clinic] = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.id, clinicId))
      .limit(1);

    if (!clinic) {
      res.status(404).json({
        error: { code: "CLINIC_NOT_FOUND", message: "La clínica no existe" },
      });
      return;
    }

    const [alreadyMember] = await db
      .select({ id: member.id })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, clinicId), eq(user.email, normalizedEmail)))
      .limit(1);

    if (alreadyMember) {
      res.status(409).json({
        error: { code: "ALREADY_MEMBER", message: "Esa persona ya es miembro de la clínica" },
      });
      return;
    }

    const [alreadyInvited] = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, clinicId),
          eq(invitation.email, normalizedEmail),
          eq(invitation.status, "pending"),
        ),
      )
      .limit(1);

    if (alreadyInvited) {
      res.status(409).json({
        error: {
          code: "ALREADY_INVITED",
          message: "Ya hay una invitación pendiente para ese email. Puedes reenviarla.",
        },
      });
      return;
    }

    // One owner change at a time: cancel the pending one to invite someone else
    if (role === "owner") {
      const [pendingOwner] = await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, clinicId),
            eq(invitation.role, "owner"),
            eq(invitation.status, "pending"),
          ),
        )
        .limit(1);

      if (pendingOwner) {
        res.status(409).json({
          error: {
            code: "OWNER_INVITATION_PENDING",
            message:
              "Ya hay una invitación de propietario pendiente. Cancélala para invitar a otra persona.",
          },
        });
        return;
      }
    }

    const [created] = await db
      .insert(invitation)
      .values({
        id: generateId(),
        organizationId: clinicId,
        email: normalizedEmail,
        role,
        status: "pending",
        expiresAt: invitationExpiryDate(),
        inviterId: req.user!.id,
      })
      .returning(invitationColumns);

    await sendInvitationEmail({
      invitationId: created!.id,
      email: normalizedEmail,
      role,
      clinicName: clinic.name,
      inviterName: req.user!.name,
    });

    res.status(201).json({ invitation: created });
  } catch (error) {
    console.error("createInvitation failed:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "No se pudo enviar la invitación" },
    });
  }
};

type InvitationParams = { clinicId: string; invitationId: string };

// A pending invitation that belongs to this clinic, or null after sending a 404
async function findPendingInvitation(
  { clinicId, invitationId }: InvitationParams,
  res: Response,
) {
  const [found] = await db
    .select({ ...invitationColumns, clinicName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.organizationId, clinicId),
        eq(invitation.status, "pending"),
      ),
    )
    .limit(1);

  if (!found) {
    res.status(404).json({
      error: {
        code: "INVITATION_NOT_FOUND",
        message: "La invitación no existe o ya no está pendiente",
      },
    });
    return null;
  }
  return found;
}

// Super-admin only: sends the same invitation again with a fresh expiry date
// (same behaviour as Better Auth's resend)
export const resendInvitation = async (
  req: Request<InvitationParams>,
  res: Response,
) => {
  try {
    const found = await findPendingInvitation(req.params, res);
    if (!found) return;

    const [updated] = await db
      .update(invitation)
      .set({ expiresAt: invitationExpiryDate() })
      .where(eq(invitation.id, found.id))
      .returning(invitationColumns);

    await sendInvitationEmail({
      invitationId: found.id,
      email: found.email,
      role: found.role ?? "member",
      clinicName: found.clinicName,
      inviterName: req.user!.name,
    });

    res.json({ invitation: updated });
  } catch (error) {
    console.error("resendInvitation failed:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "No se pudo reenviar la invitación" },
    });
  }
};

// Super-admin only: the link stops working. Kept as "canceled", like Better Auth
export const cancelInvitation = async (
  req: Request<InvitationParams>,
  res: Response,
) => {
  try {
    const found = await findPendingInvitation(req.params, res);
    if (!found) return;

    await db
      .update(invitation)
      .set({ status: "canceled" })
      .where(eq(invitation.id, found.id));

    res.status(204).end();
  } catch (error) {
    console.error("cancelInvitation failed:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "No se pudo cancelar la invitación" },
    });
  }
};

const CLINIC_STATUSES = ["active", "inactive"];

export const updateClinic = async (
  req: Request<{ clinicId: string }>,
  res: Response,
) => {
  const { clinicId } = req.params;
  const { name, slug, logo, status, isPublic } = req.body ?? {};

  const badRequest = (code: string, message: string) =>
    res.status(400).json({ error: { code, message } });

  // Validate only what was sent
  const updates: Partial<typeof organization.$inferInsert> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return badRequest("INVALID_NAME", "El nombre es obligatorio");
    }
    updates.name = name.trim();
  }
  if (slug !== undefined) {
    if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
      return badRequest(
        "INVALID_SLUG",
        "La URL solo puede tener minúsculas, números y guiones",
      );
    }
    updates.slug = slug;
  }
  if (logo !== undefined) {
    // null or "" removes the logo
    if (logo !== null && typeof logo !== "string") {
      return badRequest("INVALID_LOGO", "El logo debe ser una URL");
    }
    updates.logo = logo?.trim() || null;
  }
  if (status !== undefined) {
    if (!CLINIC_STATUSES.includes(status)) {
      return badRequest(
        "INVALID_STATUS",
        `El estado debe ser uno de: ${CLINIC_STATUSES.join(", ")}`,
      );
    }
    updates.status = status;
  }
  if (isPublic !== undefined) {
    if (typeof isPublic !== "boolean") {
      return badRequest("INVALID_IS_PUBLIC", "isPublic debe ser true o false");
    }
    updates.isPublic = isPublic;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }

  try {
    // Slugs are unique: give a clear message instead of a database error
    if (updates.slug) {
      const [taken] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(
          and(
            eq(organization.slug, updates.slug),
            ne(organization.id, clinicId),
          ),
        )
        .limit(1);

      if (taken) {
        res.status(409).json({
          error: {
            code: "SLUG_TAKEN",
            message: "Ya existe una clínica con esa URL",
          },
        });
        return;
      }
    }

    const [clinic] = await db
      .update(organization)
      .set(updates)
      .where(eq(organization.id, clinicId))
      .returning(clinicColumns);

    if (!clinic) {
      res.status(404).json({
        error: { code: "CLINIC_NOT_FOUND", message: "La clínica no existe" },
      });
      return;
    }

    res.json({ clinic });
  } catch (error) {
    console.error("updateClinic failed:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "No se pudo actualizar la clínica",
      },
    });
  }
};

// Roles that can be given here. "owner" only comes from an owner invitation
const ASSIGNABLE_ROLES = CLINIC_ROLES.filter((r) => r !== "owner");

// Super-admin only: change the role of several members at once.
// Body: { changes: [{ memberId, role }] }. All or nothing.
export const updateMemberRoles = async (
  req: Request<{ clinicId: string }>,
  res: Response,
) => {
  const { clinicId } = req.params;
  const { changes } = req.body ?? {};

  const badRequest = (code: string, message: string) =>
    res.status(400).json({ error: { code, message } });

  if (!Array.isArray(changes) || changes.length === 0) {
    return badRequest("NO_CHANGES", "No hay cambios que guardar");
  }
  for (const change of changes) {
    if (typeof change?.memberId !== "string") {
      return badRequest("INVALID_MEMBER", "Falta el miembro en uno de los cambios");
    }
    if (!isClinicRole(change.role) || !ASSIGNABLE_ROLES.includes(change.role)) {
      return badRequest(
        "INVALID_ROLE",
        `El rol debe ser uno de: ${ASSIGNABLE_ROLES.join(", ")}. El propietario se cambia con una invitación.`,
      );
    }
  }

  const memberIds: string[] = changes.map((c: { memberId: string }) => c.memberId);
  if (new Set(memberIds).size !== memberIds.length) {
    return badRequest("DUPLICATE_MEMBER", "Hay un miembro repetido en los cambios");
  }

  try {
    // Every member must be in this clinic, and the owner can't be changed here
    const targets = await db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, clinicId), inArray(member.id, memberIds)));

    if (targets.length !== memberIds.length) {
      res.status(404).json({
        error: {
          code: "MEMBER_NOT_FOUND",
          message: "Algún miembro no existe o no pertenece a esta clínica",
        },
      });
      return;
    }
    if (targets.some((t) => t.role === "owner")) {
      return badRequest(
        "CANNOT_CHANGE_OWNER",
        "El rol del propietario no se puede cambiar. Usa «Cambiar propietario».",
      );
    }

    await db.transaction(async (tx) => {
      for (const { memberId, role } of changes as { memberId: string; role: string }[]) {
        await tx.update(member).set({ role }).where(eq(member.id, memberId));
      }
    });

    res.json({ members: await getClinicMembers(clinicId) });
  } catch (error) {
    console.error("updateMemberRoles failed:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "No se pudieron guardar los roles" },
    });
  }
};
