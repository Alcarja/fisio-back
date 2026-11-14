import type { Request, Response } from "express";
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointment, appointmentPatient, member, service, user } from "../db/schema.js";
import { PROFESSIONAL_ROLES } from "../lib/appointments.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { utcToZoned, zonedToUtc } from "../lib/timezone.js";

// Reports (Informes) of the session's active clinic. Owners and admins only
// (checked in report.routes.ts).

// "2026-11" (months 01 to 12)
const isMonth = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// "2026-11" -> "2026-12-01", "2026-12" -> "2027-01-01"
function firstDayOfNextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const notCancelled = sql`${appointment.status} <> 'cancelled'`;

// GET /clinic/reports/monthly?month=YYYY-MM (default: this month, clinic time)
//
// The month's appointments counted per physio × service pair (cells). Every
// other total (per service, per physio, the whole clinic) is a sum of cells,
// done in the frontend. Response:
// - month, timezone: the month is counted in the clinic's local time
// - services: active services, plus inactive ones with appointments that month
// - professionals: owners, admins and physios, plus former members with
//   appointments that month (so every cell has a name)
// - cells: { physioId, serviceId, appointments, minutes, patients, noShows, cancelled }
//   appointments/minutes/patients leave cancelled ones out; minutes is session
//   time (ends_at - starts_at, no buffer); patients counts each patient of a group
export const getMonthlyReport = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const timeZone = await loadTimezone(clinicId);

  const { month: requested } = req.query;
  if (requested !== undefined && !isMonth(requested)) {
    res.status(400).json({
      error: { code: "INVALID_MONTH", message: "month debe tener el formato AAAA-MM" },
    });
    return;
  }
  const month = requested ?? utcToZoned(new Date(), timeZone).date.slice(0, 7);

  // The month in UTC: from the 1st at 00:00 to the next month's 1st at 00:00,
  // both in the clinic's time zone (handles daylight saving changes)
  const from = zonedToUtc(`${month}-01`, "00:00", timeZone);
  const to = zonedToUtc(firstDayOfNextMonth(month), "00:00", timeZone);

  // Patients per appointment (group sessions have several)
  const patientCounts = db
    .select({
      appointmentId: appointmentPatient.appointmentId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(appointmentPatient)
    .where(eq(appointmentPatient.organizationId, clinicId))
    .groupBy(appointmentPatient.appointmentId)
    .as("patient_counts");

  const cells = await db
    .select({
      physioId: appointment.physioId,
      serviceId: appointment.serviceId,
      appointments: sql<number>`(count(*) filter (where ${notCancelled}))::int`,
      minutes: sql<number>`coalesce(sum(extract(epoch from ${appointment.endsAt} - ${appointment.startsAt}) / 60) filter (where ${notCancelled}), 0)::int`,
      patients: sql<number>`coalesce(sum(${patientCounts.count}) filter (where ${notCancelled}), 0)::int`,
      noShows: sql<number>`(count(*) filter (where ${appointment.status} = 'no_show'))::int`,
      cancelled: sql<number>`(count(*) filter (where ${appointment.status} = 'cancelled'))::int`,
    })
    .from(appointment)
    .leftJoin(patientCounts, eq(patientCounts.appointmentId, appointment.id))
    .where(
      and(
        eq(appointment.organizationId, clinicId),
        gte(appointment.startsAt, from),
        lt(appointment.startsAt, to),
      ),
    )
    .groupBy(appointment.physioId, appointment.serviceId);

  const cellServiceIds = [...new Set(cells.map((c) => c.serviceId))];
  const cellPhysioIds = [...new Set(cells.map((c) => c.physioId))];

  const [services, professionals] = await Promise.all([
    db
      .select({ id: service.id, name: service.name, color: service.color })
      .from(service)
      .where(
        and(
          eq(service.organizationId, clinicId),
          cellServiceIds.length > 0
            ? or(eq(service.isActive, true), inArray(service.id, cellServiceIds))
            : eq(service.isActive, true),
        ),
      )
      .orderBy(asc(service.name)),

    db
      .select({ userId: user.id, name: user.name, image: user.image })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(eq(member.organizationId, clinicId), inArray(member.role, PROFESSIONAL_ROLES)),
      )
      .orderBy(asc(user.name)),
  ]);

  // Physios with appointments this month who have since left the clinic (or
  // changed to a non-professional role): their names come from the user table
  const listed = new Set(professionals.map((p) => p.userId));
  const missing = cellPhysioIds.filter((id) => !listed.has(id));
  if (missing.length > 0) {
    const former = await db
      .select({ userId: user.id, name: user.name, image: user.image })
      .from(user)
      .where(inArray(user.id, missing));
    professionals.push(...former);
  }

  res.json({ month, timezone: timeZone, services, professionals, cells });
};
