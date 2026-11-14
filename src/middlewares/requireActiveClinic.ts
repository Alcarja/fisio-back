import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { member } from "../db/schema.js";
import { isClinicRole, type ClinicRole } from "../lib/permissions.js";

// Use after requireAuth, on every endpoint that works with a clinic's data.
//
// The clinic always comes from the session's active clinic (chosen in the
// frontend's clinic switcher), never from the URL or the body, so nobody can
// reach another clinic's data by changing an id.
//
// On success: req.clinicId and req.clinicRole are set.
export function requireActiveClinic(allowedRoles: readonly ClinicRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clinicId = req.session?.activeOrganizationId;

    if (!clinicId) {
      res.status(400).json({
        error: { code: "NO_ACTIVE_CLINIC", message: "Selecciona una clínica primero" },
      });
      return;
    }

    try {
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, clinicId), eq(member.userId, req.user!.id)))
        .limit(1);

      if (!membership || !isClinicRole(membership.role)) {
        res.status(403).json({
          error: { code: "NOT_A_MEMBER", message: "No perteneces a esta clínica" },
        });
        return;
      }

      if (!allowedRoles.includes(membership.role)) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Tu rol en esta clínica no tiene acceso a esta sección",
          },
        });
        return;
      }

      req.clinicId = clinicId;
      req.clinicRole = membership.role;
      next();
    } catch (error) {
      next(error);
    }
  };
}
