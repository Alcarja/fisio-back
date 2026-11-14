import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  clinicOpeningHours,
  clinicScheduleException,
  clinicScheduleExceptionHours,
  organization,
} from "../db/schema.js";
import { toHHMM } from "./schedule.js";

// Reading a clinic's schedule, shared by Configuración → Horario and the
// calendar. Times come back as "HH:MM" (clinic local time).

export async function loadTimezone(clinicId: string) {
  const [clinic] = await db
    .select({ timezone: organization.timezone })
    .from(organization)
    .where(eq(organization.id, clinicId))
    .limit(1);
  return clinic?.timezone ?? "Europe/Madrid";
}

export async function loadWeeklyHours(clinicId: string) {
  const rows = await db
    .select({
      weekday: clinicOpeningHours.weekday,
      startTime: clinicOpeningHours.startTime,
      endTime: clinicOpeningHours.endTime,
    })
    .from(clinicOpeningHours)
    .where(eq(clinicOpeningHours.organizationId, clinicId))
    .orderBy(asc(clinicOpeningHours.weekday), asc(clinicOpeningHours.startTime));

  return rows.map((h) => ({
    weekday: h.weekday,
    startTime: toHHMM(h.startTime),
    endTime: toHHMM(h.endTime),
  }));
}

type ExceptionFilter = {
  ids?: string[]; // only these exceptions
  from?: string; // only exceptions touching [from, to] ("YYYY-MM-DD")
  to?: string;
};

// A clinic's exceptions, each with its special hours
export async function loadExceptions(clinicId: string, filter: ExceptionFilter = {}) {
  const exceptions = await db
    .select({
      id: clinicScheduleException.id,
      type: clinicScheduleException.type,
      startDate: clinicScheduleException.startDate,
      endDate: clinicScheduleException.endDate,
      reason: clinicScheduleException.reason,
    })
    .from(clinicScheduleException)
    .where(
      and(
        eq(clinicScheduleException.organizationId, clinicId),
        filter.ids ? inArray(clinicScheduleException.id, filter.ids) : undefined,
        // Overlaps the range: starts before it ends and ends after it starts
        filter.to ? lte(clinicScheduleException.startDate, filter.to) : undefined,
        filter.from ? gte(clinicScheduleException.endDate, filter.from) : undefined,
      ),
    )
    .orderBy(asc(clinicScheduleException.startDate));

  if (exceptions.length === 0) return [];

  const hours = await db
    .select()
    .from(clinicScheduleExceptionHours)
    .where(
      inArray(
        clinicScheduleExceptionHours.exceptionId,
        exceptions.map((e) => e.id),
      ),
    )
    .orderBy(asc(clinicScheduleExceptionHours.startTime));

  return exceptions.map((e) => ({
    ...e,
    hours: hours
      .filter((h) => h.exceptionId === e.id)
      .map((h) => ({
        weekday: h.weekday,
        startTime: toHHMM(h.startTime),
        endTime: toHHMM(h.endTime),
      })),
  }));
}
