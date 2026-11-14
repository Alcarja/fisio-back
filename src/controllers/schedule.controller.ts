import type { Request, Response } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { isPhysioOverlapError } from "../lib/appointments.js";
import { db } from "../db/index.js";
import {
  clinicOpeningHours,
  clinicScheduleException,
  clinicScheduleExceptionHours,
  organization,
} from "../db/schema.js";
import {
  groupBy,
  isIsoDate,
  isTime,
  isTimezone,
  isWeekday,
  rangesError,
} from "../lib/schedule.js";
import { loadExceptions, loadTimezone, loadWeeklyHours } from "../lib/clinicSchedule.js";

// Configuración → Horario of the active clinic (owners and admins).
// The clinic is always req.clinicId, set by requireActiveClinic from the session.

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

type ExceptionHoursInput = { weekday: number | null; startTime: string; endTime: string };

// GET /clinic/settings/schedule -> { timezone, weeklyHours, exceptions }
export const getSchedule = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;

  const [timezone, weeklyHours, exceptions] = await Promise.all([
    loadTimezone(clinicId),
    loadWeeklyHours(clinicId),
    loadExceptions(clinicId),
  ]);

  res.json({ timezone, weeklyHours, exceptions });
};

// PUT /clinic/settings/schedule/hours   body: { weeklyHours: [{ weekday, startTime, endTime }] }
// Replaces the whole week. A day with no slots is closed
export const updateWeeklyHours = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { weeklyHours } = req.body ?? {};

  if (!Array.isArray(weeklyHours)) {
    return badRequest(res, "INVALID_HOURS", "Falta el horario semanal");
  }
  for (const slot of weeklyHours) {
    if (!isWeekday(slot?.weekday) || !isTime(slot?.startTime) || !isTime(slot?.endTime)) {
      return badRequest(
        res,
        "INVALID_HOURS",
        "Cada franja necesita un día (1-7) y horas en formato HH:MM",
      );
    }
  }
  const slots = weeklyHours as { weekday: number; startTime: string; endTime: string }[];
  for (const [weekday, daySlots] of groupBy(slots, (s) => s.weekday)) {
    const error = rangesError(daySlots);
    if (error) return badRequest(res, "INVALID_HOURS", `Día ${weekday}: ${error}`);
  }

  // Delete and insert together, so nobody ever sees a half-saved week
  await db.transaction(async (tx) => {
    await tx.delete(clinicOpeningHours).where(eq(clinicOpeningHours.organizationId, clinicId));
    if (slots.length > 0) {
      await tx.insert(clinicOpeningHours).values(
        slots.map((s) => ({
          organizationId: clinicId,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
    }
  });

  res.status(204).end();
};

// PATCH /clinic/settings/schedule/timezone   body: { timezone }
// Appointments and room blocks keep their LOCAL time (the time the patient
// knows): an appointment at 09:00 is still at 09:00 in the new zone. They're
// stored in UTC, so their UTC instants are recalculated.
export const updateTimezone = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { timezone } = req.body ?? {};

  if (!isTimezone(timezone)) {
    return badRequest(res, "INVALID_TIMEZONE", "La zona horaria no es válida");
  }

  const oldTimezone = await loadTimezone(clinicId);
  if (oldTimezone === timezone) {
    res.status(204).end();
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(organization).set({ timezone }).where(eq(organization.id, clinicId));

      // UTC instant -> local time in the old zone -> same local time in the new
      // zone. Postgres handles daylight saving time for each date
      await tx.execute(sql`
        update appointment
        set starts_at = (starts_at at time zone ${oldTimezone}) at time zone ${timezone},
            ends_at   = (ends_at   at time zone ${oldTimezone}) at time zone ${timezone}
        where organization_id = ${clinicId}
      `);
      await tx.execute(sql`
        update room_block
        set starts_at = (starts_at at time zone ${oldTimezone}) at time zone ${timezone},
            ends_at   = (ends_at   at time zone ${oldTimezone}) at time zone ${timezone}
        where room_id in (select id from room where organization_id = ${clinicId})
      `);
    });
  } catch (error) {
    // Moving the appointments made a physio overlap with another of theirs
    // (e.g. in another clinic, which keeps its times). Nothing was changed
    if (isPhysioOverlapError(error)) {
      res.status(409).json({
        error: {
          code: "TIMEZONE_CONFLICT",
          message:
            "No se puede cambiar la zona horaria: alguna cita se solaparía con otra del mismo fisio. No se ha cambiado nada.",
        },
      });
      return;
    }
    throw error;
  }

  res.status(204).end();
};

// POST /clinic/settings/schedule/exceptions
// body: { type, startDate, endDate, reason?, hours? }  -> 201 { exception }
export const createException = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { type, startDate, endDate, reason, hours } = req.body ?? {};

  if (type !== "closed" && type !== "special_hours") {
    return badRequest(res, "INVALID_TYPE", "El tipo debe ser closed o special_hours");
  }
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return badRequest(res, "INVALID_DATES", "Las fechas deben tener el formato AAAA-MM-DD");
  }
  if (endDate < startDate) {
    return badRequest(res, "INVALID_DATES", "La fecha de fin no puede ser anterior a la de inicio");
  }
  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return badRequest(res, "INVALID_REASON", "El motivo debe ser un texto");
  }

  // Special hours need at least one valid slot; "closed" ignores hours
  let exceptionHours: ExceptionHoursInput[] = [];
  if (type === "special_hours") {
    if (!Array.isArray(hours) || hours.length === 0) {
      return badRequest(res, "INVALID_HOURS", "Un horario especial necesita al menos una franja");
    }
    for (const h of hours) {
      const weekdayOk = h?.weekday === null || h?.weekday === undefined || isWeekday(h?.weekday);
      if (!weekdayOk || !isTime(h?.startTime) || !isTime(h?.endTime)) {
        return badRequest(
          res,
          "INVALID_HOURS",
          "Cada franja necesita horas en formato HH:MM (y un día 1-7, o ninguno para todos)",
        );
      }
    }
    exceptionHours = (hours as ExceptionHoursInput[]).map((h) => ({
      weekday: h.weekday ?? null,
      startTime: h.startTime,
      endTime: h.endTime,
    }));
    for (const group of groupBy(exceptionHours, (h) => h.weekday).values()) {
      const error = rangesError(group);
      if (error) return badRequest(res, "INVALID_HOURS", error);
    }
  }

  // Two exceptions on the same day would be ambiguous: refuse overlaps
  const [overlapping] = await db
    .select({ id: clinicScheduleException.id })
    .from(clinicScheduleException)
    .where(
      and(
        eq(clinicScheduleException.organizationId, clinicId),
        lte(clinicScheduleException.startDate, endDate),
        gte(clinicScheduleException.endDate, startDate),
      ),
    )
    .limit(1);

  if (overlapping) {
    res.status(409).json({
      error: {
        code: "EXCEPTION_OVERLAP",
        message: "Ya hay una excepción en esas fechas. Elimínala o elige otras fechas.",
      },
    });
    return;
  }

  const exceptionId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(clinicScheduleException)
      .values({
        organizationId: clinicId,
        type,
        startDate,
        endDate,
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      })
      .returning({ id: clinicScheduleException.id });

    if (exceptionHours.length > 0) {
      await tx
        .insert(clinicScheduleExceptionHours)
        .values(exceptionHours.map((h) => ({ ...h, exceptionId: created!.id })));
    }
    return created!.id;
  });

  const [exception] = await loadExceptions(clinicId, { ids: [exceptionId] });
  res.status(201).json({ exception });
};

// DELETE /clinic/settings/schedule/exceptions/:exceptionId -> 204
// Its special hours are deleted with it (onDelete: cascade)
export const deleteException = async (
  req: Request<{ exceptionId: string }>,
  res: Response,
) => {
  const deleted = await db
    .delete(clinicScheduleException)
    .where(
      and(
        eq(clinicScheduleException.id, req.params.exceptionId),
        // Only this clinic's exceptions
        eq(clinicScheduleException.organizationId, req.clinicId!),
      ),
    )
    .returning({ id: clinicScheduleException.id });

  if (deleted.length === 0) {
    res.status(404).json({
      error: { code: "EXCEPTION_NOT_FOUND", message: "Esta excepción no existe en tu clínica" },
    });
    return;
  }

  res.status(204).end();
};
