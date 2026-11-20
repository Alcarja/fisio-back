import type { Request, Response } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { db, pool } from "../db/index.js";
import { invitation, member, organization, session, user } from "../db/schema.js";
import { withWelcomeEmail } from "../lib/email/index.js";
import { getClinicMembers, getPendingInvitations } from "../lib/clinicTeam.js";
import { isClinicRole, type ClinicRole } from "../lib/permissions.js";
import { PROFESSIONAL_ROLES } from "../lib/appointments.js";
import { priceImpact, type PriceImpact } from "../lib/plans.js";
import { utcToZoned } from "../lib/timezone.js";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// ---------- The price of a new professional (lib/plans.ts) ----------
//
// The clinic's fee depends on how many professionals it has (owner, admin,
// physio; reception is free). When adding someone, inviting them or changing
// their role would move it to a dearer tier, the clinic has to confirm it
// first: the request is refused with PRICE_CHANGE and the numbers, and sent
// again with confirmPriceChange: true. Checked here, not in the browser, so
// nobody can skip it. The new price counts from next month. Going down a tier
// is only reported (priceChange in the answer).

const isProfessional = (role: string | null | undefined) =>
  (role ?? "").split(",").some((r) => PROFESSIONAL_ROLES.includes(r));

function nextMonth() {
  const [y, m] = utcToZoned(new Date(), "Europe/Madrid").date.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m!, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The impact of `delta` professionals, or false after refusing an unconfirmed raise
async function checkPrice(req: Request, res: Response, delta: number): Promise<PriceImpact | null | false> {
  const impact = await priceImpact(req.clinicId!, delta, nextMonth());
  if (impact?.increase && req.body?.confirmPriceChange !== true) {
    res.status(409).json({
      error: {
        code: "PRICE_CHANGE",
        message: "Este cambio sube la cuota de la clínica: confírmalo para continuar",
        priceChange: impact,
      },
    });
    return false;
  }
  return impact?.changes ? impact : null;
}

// One team change at a time per clinic: checking the price and adding the
// person must happen together, or two owners clicking at once could both
// pass the check and jump a tier nobody confirmed. A transaction-level
// advisory lock held on its own connection until the change is done (the
// API goes through Neon's pooler, where session-level locks aren't reliable).
// Other servers running the API wait for it too
async function oneAtATime(req: Request, res: Response, change: () => Promise<void>) {
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '15s'");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`kineflow_team:${req.clinicId}`]);
    locked = true;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    client.release();
    if ((error as { code?: string }).code !== "55P03") throw error;
    res.status(409).json({
      error: { code: "TEAM_BUSY", message: "Se está guardando otro cambio del equipo. Inténtalo de nuevo en unos segundos" },
    });
    return;
  }
  try {
    await change();
  } finally {
    if (locked) await client.query("commit").catch(() => {});
    client.release();
  }
}

export const getTeam = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;

  const [members, invitations] = await Promise.all([
    getClinicMembers(clinicId),
    getPendingInvitations(clinicId),
  ]);

  res.json({ members, invitations });
};

// Owners and admins: add someone to the active clinic.
// - New email: the account is created and joins right away (they get a link
//   to choose their password).
// - Existing account: it belongs to someone who may already work elsewhere, so
//   they get an invitation and join only if they accept it
export const addMember = (req: Request, res: Response) => oneAtATime(req, res, () => addMemberNow(req, res));
const addMemberNow = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { email: rawEmail, name, role } = req.body ?? {};

  if (typeof rawEmail !== "string" || !rawEmail.includes("@")) {
    res.status(400).json({
      error: { code: "INVALID_EMAIL", message: "El email no es válido" },
    });
    return;
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({
      error: { code: "INVALID_NAME", message: "El nombre no es válido" },
    });
    return;
  }
  if (!isClinicRole(role)) {
    res.status(400).json({
      error: { code: "INVALID_ROLE", message: "El rol no es válido" },
    });
    return;
  }
  // Only an owner can make someone else an owner
  if (role === "owner" && req.clinicRole !== "owner") {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Solo un propietario puede añadir otro propietario" },
    });
    return;
  }

  const email = rawEmail.trim().toLowerCase();

  // Already invited (still pending)? Then they already count with that
  // invitation's role: inviting again only changes what the role adds
  const [pending] = await db
    .select({ id: invitation.id, role: invitation.role })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, clinicId),
        sql`lower(${invitation.email}) = ${email}`,
        eq(invitation.status, "pending"),
        sql`${invitation.expiresAt} > now()`,
      ),
    )
    .limit(1);

  // A professional (now or when they accept the invitation) may raise the fee
  const priceChange = await checkPrice(req, res, Number(isProfessional(role)) - Number(!!pending && isProfessional(pending.role)));
  if (priceChange === false) return;

  try {
    // 1. Does the user exist?
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    // 2. If it exists, is it already a member of this clinic?
    if (targetUser) {
      const [existingMember] = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, clinicId), eq(member.userId, targetUser.id)))
        .limit(1);

      if (existingMember) {
        res.status(409).json({
          error: { code: "ALREADY_A_MEMBER", message: "Este usuario ya pertenece a la clínica" },
        });
        return;
      }

      // Invite instead of adding: Better Auth checks the inviter's rights
      // (only an owner can invite an owner) and emails the invitation.
      // resend: inviting again just resends the pending one
      await auth.api.createInvitation({
        headers: fromNodeHeaders(req.headers),
        body: { email, role, organizationId: clinicId, resend: true },
      });
      // Resending keeps the role it was sent with: give it the one asked for now
      if (pending && pending.role !== role) {
        await db.update(invitation).set({ role }).where(eq(invitation.id, pending.id));
      }

      const invitations = await getPendingInvitations(clinicId);
      const sent = invitations.find((i) => i.email.toLowerCase() === email);

      res.status(201).json({ invited: true, invitation: sent, priceChange });
      return;
    }

    // 3. New email: create the account without a password.
    // Server-side call (no headers): skips the admin plugin's super-admin check.
    const { user: createdUser } = await auth.api.createUser({
      body: { email, name: name?.trim() || email.split("@")[0]! },
    });

    // 4. Create the membership (permissions were checked by requireActiveClinic)
    await auth.api.addMember({
      body: { userId: createdUser.id, role, organizationId: clinicId },
    });

    // 5. They get the clinic's welcome email with a link to choose their
    // password. Resetting it also creates their email/password account.
    const [clinic] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, clinicId))
      .limit(1);

    await withWelcomeEmail(
      {
        clinicName: clinic?.name ?? "tu clínica",
        inviterName: req.user!.name,
        role,
        replyTo: req.user!.email,
      },
      () =>
        auth.api.requestPasswordReset({
          body: { email, redirectTo: `${frontendUrl}/reset-password` },
        }),
    );

    // Return the new member in the same shape as getTeam
    const members = await getClinicMembers(clinicId);
    const created = members.find((m) => m.userId === createdUser.id);

    res.status(201).json({ invited: false, member: created, priceChange });
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.statusCode).json({
        error: { code: error.body?.code ?? "ADD_MEMBER_FAILED", message: error.message },
      });
      return;
    }
    throw error;
  }
};

// ---------- Managing an existing member (owners and admins) ----------

type MemberParams = { memberId: string };

// The member to act on, or null after sending the error. They must belong to
// the session's active clinic (never trust a clinic id from the request), and
// can't be the owner (ownership only changes by invitation) or yourself
async function findManageableMember(req: Request<MemberParams>, res: Response) {
  const [target] = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      name: user.name,
      platformRole: user.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.id, req.params.memberId), eq(member.organizationId, req.clinicId!)))
    .limit(1);

  if (!target) {
    res.status(404).json({
      error: { code: "MEMBER_NOT_FOUND", message: "Este miembro no pertenece a tu clínica" },
    });
    return null;
  }
  if (target.role === "owner") {
    res.status(403).json({
      error: {
        code: "CANNOT_MANAGE_OWNER",
        message: "El propietario solo se puede cambiar con una invitación",
      },
    });
    return null;
  }
  if (target.userId === req.user!.id) {
    res.status(403).json({
      error: { code: "CANNOT_MANAGE_SELF", message: "No puedes hacer esto sobre ti mismo" },
    });
    return null;
  }
  return target;
}

// PATCH /clinic/team/members/:memberId/role   body: { role }
export const updateMemberRole = (req: Request<MemberParams>, res: Response) =>
  oneAtATime(req, res, () => updateMemberRoleNow(req, res));
const updateMemberRoleNow = async (req: Request<MemberParams>, res: Response) => {
  const { role } = req.body ?? {};

  if (!isClinicRole(role) || role === "owner") {
    res.status(400).json({
      error: {
        code: "INVALID_ROLE",
        message: "El rol debe ser admin, receptionist o physio",
      },
    });
    return;
  }

  const target = await findManageableMember(req, res);
  if (!target) return;

  // Reception -> physio adds a professional (and the opposite takes one away)
  const priceChange = await checkPrice(req, res, Number(isProfessional(role)) - Number(isProfessional(target.role)));
  if (priceChange === false) return;

  await db.update(member).set({ role }).where(eq(member.id, target.memberId));

  const members = await getClinicMembers(req.clinicId!);
  res.json({ member: members.find((m) => m.memberId === target.memberId), priceChange });
};

// DELETE /clinic/team/members/:memberId -> { priceChange }
// Takes them out of this clinic only: their account and other clinics stay
export const removeMember = async (req: Request<MemberParams>, res: Response) => {
  const target = await findManageableMember(req, res);
  if (!target) return;
  // Taking a professional away may lower the fee: only reported, never refused
  const priceChange = isProfessional(target.role) ? await checkPrice(req, res, -1) : null;

  await db.transaction(async (tx) => {
    await tx.delete(member).where(eq(member.id, target.memberId));
    // If they were working in this clinic, their sessions stop pointing to it
    // (next time they'll have to pick another clinic, or see they have none)
    await tx
      .update(session)
      .set({ activeOrganizationId: null })
      .where(
        and(eq(session.userId, target.userId), eq(session.activeOrganizationId, req.clinicId!)),
      );
  });

  res.json({ priceChange: priceChange || null });
};

// Same limits as Better Auth (auth.ts emailAndPassword + its default maximum)
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

// Whose password owners and admins can set (mirrored in the frontend's MemberActions)
const PASSWORD_MANAGEABLE_ROLES: readonly ClinicRole[] = ["physio", "receptionist"];

// POST /clinic/team/members/:memberId/password   body: { newPassword }
// Sets a new password and logs them out everywhere, so they must use it
export const setMemberPassword = async (req: Request<MemberParams>, res: Response) => {
  const { newPassword } = req.body ?? {};

  if (
    typeof newPassword !== "string" ||
    newPassword.length < MIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_PASSWORD_LENGTH
  ) {
    res.status(400).json({
      error: {
        code: "INVALID_PASSWORD",
        message: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`,
      },
    });
    return;
  }

  const target = await findManageableMember(req, res);
  if (!target) return;

  // Only staff without management rights: an admin can't take over another
  // admin's account (they'd get the same rights plus that person's identity)
  if (!PASSWORD_MANAGEABLE_ROLES.includes(target.role as ClinicRole)) {
    res.status(403).json({
      error: {
        code: "PASSWORD_NOT_MANAGEABLE",
        message: "Solo puedes cambiar la contraseña de fisioterapeutas y recepcionistas",
      },
    });
    return;
  }

  // A password belongs to the person, not to the clinic. If they also work in
  // another clinic (or are a super-admin), one clinic's admin shouldn't be able
  // to change it: they can use "forgot password" instead
  const [otherClinic] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, target.userId), ne(member.organizationId, req.clinicId!)))
    .limit(1);

  if (otherClinic || target.platformRole === "superadmin") {
    res.status(403).json({
      error: {
        code: "PASSWORD_NOT_MANAGEABLE",
        message: `${target.name} también trabaja en otra clínica. Puede cambiar su contraseña con «He olvidado mi contraseña».`,
      },
    });
    return;
  }

  // Same steps as Better Auth's own "set password": hash it, then update the
  // email/password account, or create it if they only had Google
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  const credentialAccount = await ctx.internalAdapter.findCredentialAccount(target.userId);

  if (credentialAccount) {
    await ctx.internalAdapter.updatePassword(target.userId, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: target.userId,
      providerId: "credential",
      accountId: target.userId,
      password: hash,
    });
  }

  // Log them out everywhere: the old password (and its sessions) stop working
  await ctx.internalAdapter.deleteUserSessions(target.userId);

  res.status(204).end();
};
