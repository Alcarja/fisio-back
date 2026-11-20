import type { Request, Response } from "express";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentSeries,
  seriesMember,
  appointmentEvent,
  appointmentPatient,
  member,
  patient,
  room,
  service,
  user,
} from "../db/schema.js";
import {
  PROFESSIONAL_ROLES,
  appointmentIssues,
  checkAppointmentRules,
  loadParts,
  isPhysioOverlapError,
} from "../lib/appointments.js";
import { loadExceptions, loadTimezone, loadWeeklyHours } from "../lib/clinicSchedule.js";
import { isEmail, loadReminderStates } from "../lib/reminders.js";
import { isIsoDate, isTime } from "../lib/schedule.js";
import { addDaysIso, isoWeekdayOf, utcToZoned, zonedToUtc } from "../lib/timezone.js";

// Appointments of the active clinic (Reservas), for every clinic role.
// Dates and times in requests and responses are the clinic's local time
// ("2026-11-16", "09:30"); the database stores UTC.

type AppointmentStatus = "booked" | "confirmed" | "completed" | "no_show" | "cancelled";
const STATUSES: AppointmentStatus[] = ["booked", "confirmed", "completed", "no_show", "cancelled"];

// A patient of an appointment: an existing ficha (patientId), or just the names
// of someone without ficha (kept only on the appointment; no ficha is created),
// with the email for their reminders if the clinic wrote one
type PatientInput =
  | { patientId: string }
  | { firstName: string; lastName: string; contactEmail: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Who can change any appointment of the clinic. Everyone else (physios) can see
// them all but only change their own (where they are the physio)
const MANAGE_ALL_ROLES = ["owner", "admin", "receptionist"];
export const canManageAll = (req: Request) => MANAGE_ALL_ROLES.includes(req.clinicRole!);

export const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

export const notFound = (res: Response) =>
  send(res, 404, "APPOINTMENT_NOT_FOUND", "Esta cita no existe en tu clínica");

// [{ patientId } | { firstName, lastName, email? }]: a ficha, or both names
// for someone without one. The same ficha can't be twice in an appointment.
// null if invalid
function parsePatients(value: unknown): PatientInput[] | null {
  if (!Array.isArray(value)) return null;
  const patients: PatientInput[] = [];
  const seen = new Set<string>();
  for (const p of value) {
    if (p?.patientId !== undefined && p.patientId !== null) {
      if (typeof p.patientId !== "string" || !UUID_PATTERN.test(p.patientId)) return null;
      if (seen.has(p.patientId)) return null;
      seen.add(p.patientId);
      patients.push({ patientId: p.patientId });
      continue;
    }
    const firstName = typeof p?.firstName === "string" ? p.firstName.trim() : "";
    const lastName = typeof p?.lastName === "string" ? p.lastName.trim() : "";
    if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) return null;
    if (p.email != null && typeof p.email !== "string") return null;
    const email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
    if (email && !isEmail(email)) return null;
    patients.push({ firstName, lastName, contactEmail: email || null });
  }
  return patients;
}

type Names = { firstName: string; lastName: string };

// The fichas the patients point at, by id. null if one isn't this clinic's
export async function loadFichas(clinicId: string, patients: PatientInput[]) {
  const ids = patients.flatMap((p) => ("patientId" in p ? [p.patientId] : []));
  const fichas = new Map<string, Names>();
  if (ids.length === 0) return fichas;
  const rows = await db
    .select({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })
    .from(patient)
    .where(and(eq(patient.organizationId, clinicId), inArray(patient.id, ids)));
  for (const { id, ...names } of rows) fichas.set(id, names);
  return fichas.size === ids.length ? fichas : null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Saves an appointment's patients. Those with a ficha are linked to it, and its
// names are copied to the appointment too (they stay if the ficha is deleted).
// Those sent by name are saved as written, without ficha
export async function insertAppointmentPatients(
  tx: Tx,
  ids: { clinicId: string; appointmentId: string },
  patients: PatientInput[],
  fichas: Map<string, Names>,
) {
  const { clinicId: organizationId, appointmentId } = ids;
  // A group session may start with nobody
  if (patients.length === 0) return;
  await tx.insert(appointmentPatient).values(
    patients.map((p) =>
      "patientId" in p
        ? { ...fichas.get(p.patientId)!, patientId: p.patientId, appointmentId, organizationId }
        : { ...p, appointmentId, organizationId },
    ),
  );
}

// Replaces an appointment's patients with `patients`, keeping the rows of
// those who stay (matched by ficha, or by name for patients without one). The
// payments and attendance recorded on a row (Cobros, COBROS.md) point at it,
// so a row is only deleted when that patient really leaves the appointment
async function syncAppointmentPatients(
  tx: Tx,
  ids: { clinicId: string; appointmentId: string },
  patients: PatientInput[],
  fichas: Map<string, Names>,
) {
  const current = await tx
    .select({
      id: appointmentPatient.id,
      patientId: appointmentPatient.patientId,
      firstName: appointmentPatient.firstName,
      lastName: appointmentPatient.lastName,
    })
    .from(appointmentPatient)
    .where(
      and(
        eq(appointmentPatient.organizationId, ids.clinicId),
        eq(appointmentPatient.appointmentId, ids.appointmentId),
      ),
    );
  const sameName = (a: Names, b: Names) =>
    a.firstName.toLowerCase() === b.firstName.toLowerCase() &&
    a.lastName.toLowerCase() === b.lastName.toLowerCase();

  const kept = new Set<string>();
  const added: PatientInput[] = [];
  for (const p of patients) {
    const match = current.find(
      (row) =>
        !kept.has(row.id) &&
        ("patientId" in p ? row.patientId === p.patientId : !row.patientId && sameName(row, p)),
    );
    if (!match) {
      added.push(p);
      continue;
    }
    kept.add(match.id);
    // Refresh the copy of the names (and the email of those without ficha)
    await tx
      .update(appointmentPatient)
      .set("patientId" in p ? fichas.get(p.patientId)! : p)
      .where(eq(appointmentPatient.id, match.id));
  }

  const removed = current.filter((row) => !kept.has(row.id)).map((row) => row.id);
  if (removed.length > 0) {
    await tx.delete(appointmentPatient).where(inArray(appointmentPatient.id, removed));
  }
  if (added.length > 0) await insertAppointmentPatients(tx, ids, added, fichas);
}

const INVALID_PATIENTS =
  "Cada paciente necesita nombre y apellidos, no puede estar repetido y su email debe ser válido";
const UNKNOWN_PATIENT = "Alguno de los pacientes no existe en tu clínica";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// The ficha suggested for an online booking that wasn't linked
const suggested = alias(patient, "suggested_patient");

// Appointments with their service, room, physio and patients, in the shape
// the frontend uses. Either a date range (UTC) or specific ids
async function loadAppointments(
  clinicId: string,
  timeZone: string,
  filter: { from: Date; to: Date } | { ids: string[] },
) {
  const rows = await db
    .select({
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      cancellationReason: appointment.cancellationReason,
      notes: appointment.notes,
      source: appointment.source,
      seriesId: appointment.seriesId,
      detached: appointment.detached,
      contactPhone: appointment.contactPhone,
      contactEmail: appointment.contactEmail,
      serviceId: service.id,
      serviceName: service.name,
      serviceColor: service.color,
      serviceIsGroup: service.isGroup,
      serviceMaxPatients: service.maxPatients,
      serviceIsActive: service.isActive,
      serviceRoomTypeId: service.roomTypeId,
      roomId: room.id,
      roomName: room.name,
      roomIsActive: room.isActive,
      roomCapacity: room.capacity,
      roomTypeId: room.roomTypeId,
      physioId: user.id,
      physioName: user.name,
    })
    .from(appointment)
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .innerJoin(room, eq(appointment.roomId, room.id))
    .leftJoin(user, eq(appointment.physioId, user.id))
    .where(
      and(
        eq(appointment.organizationId, clinicId),
        "ids" in filter
          ? inArray(appointment.id, filter.ids)
          : and(gte(appointment.startsAt, filter.from), lt(appointment.startsAt, filter.to)),
      ),
    )
    .orderBy(asc(appointment.startsAt));

  if (rows.length === 0) return [];

  const patients = await db
    .select({
      id: appointmentPatient.id,
      appointmentId: appointmentPatient.appointmentId,
      // null: no ficha (appointment from before fichas, or ficha deleted)
      patientId: appointmentPatient.patientId,
      // The ficha's current name; the copy on the appointment if there's none
      firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName})`,
      lastName: sql<string>`coalesce(${patient.lastName}, ${appointmentPatient.lastName})`,
      // The email the clinic wrote (patients without ficha only)
      contactEmail: appointmentPatient.contactEmail,
      attendance: appointmentPatient.attendance,
      // Online booking not linked: a ficha with the same email (Enlazar)
      suggestedId: appointmentPatient.suggestedPatientId,
      suggestedFirst: suggested.firstName,
      suggestedLast: suggested.lastName,
    })
    .from(appointmentPatient)
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
    .leftJoin(
      suggested,
      and(eq(appointmentPatient.suggestedPatientId, suggested.id), eq(suggested.organizationId, clinicId)),
    )
    .where(
      and(
        // Always filtered by clinic: patients' names are personal data
        eq(appointmentPatient.organizationId, clinicId),
        inArray(appointmentPatient.appointmentId, rows.map((r) => r.id)),
      ),
    )
    .orderBy(asc(appointmentPatient.createdAt));

  // Whether each patient will get (or got) their reminder
  const reminderStates = await loadReminderStates(clinicId, rows);

  // Problems of future, active appointments after changes in the clinic
  // (hours, rooms, services, team). Past and cancelled ones don't need it
  const now = new Date();
  const patientCount = (id: string) => patients.filter((p) => p.appointmentId === id).length;
  const needsCheck = rows.filter((r) => r.status !== "cancelled" && r.endsAt > now);
  let issueContext: Parameters<typeof appointmentIssues>[1] | null = null;
  if (needsCheck.length > 0) {
    const dates = needsCheck.map((r) => utcToZoned(r.startsAt, timeZone).date).sort();
    const [weeklyHours, exceptions, professionals] = await Promise.all([
      loadWeeklyHours(clinicId),
      loadExceptions(clinicId, { from: dates[0], to: dates.at(-1) }),
      db
        .select({ userId: member.userId })
        .from(member)
        .where(and(eq(member.organizationId, clinicId), inArray(member.role, PROFESSIONAL_ROLES))),
    ]);
    issueContext = {
      weeklyHours,
      exceptions,
      professionalIds: new Set(professionals.map((p) => p.userId)),
      others: [],
    };
  }

  return rows.map((r) => {
    const start = utcToZoned(r.startsAt, timeZone);
    const end = utcToZoned(r.endsAt, timeZone);
    const issues =
      issueContext && r.status !== "cancelled" && r.endsAt > now
        ? appointmentIssues(
            {
              date: start.date,
              startTime: start.time,
              durationMinutes: Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000),
              startsAt: r.startsAt,
              endsAt: r.endsAt,
              patientCount: patientCount(r.id),
              roomId: r.roomId,
              roomIsActive: r.roomIsActive,
              roomCapacity: r.roomCapacity,
              roomTypeId: r.roomTypeId,
              serviceIsActive: r.serviceIsActive,
              serviceRoomTypeId: r.serviceRoomTypeId,
              serviceMaxPatients: r.serviceMaxPatients,
              physioId: r.physioId,
            },
            {
              ...issueContext,
              // The other active appointments loaded with it
              others: rows
                .filter((o) => o.id !== r.id && o.status !== "cancelled")
                .map((o) => ({
                  roomId: o.roomId,
                  startsAt: o.startsAt,
                  endsAt: o.endsAt,
                  patientCount: patientCount(o.id),
                })),
            },
          )
        : [];
    return {
      id: r.id,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      durationMinutes: Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000),
      status: r.status,
      cancellationReason: r.cancellationReason,
      notes: r.notes,
      // "online": booked by the patient, with how to reach them
      source: r.source,
      contactPhone: r.contactPhone,
      contactEmail: r.contactEmail,
      // Part of a weekly series (null: a single appointment). detached: changed
      // by hand, it no longer follows the series
      seriesId: r.seriesId,
      detached: r.detached,
      service: {
        id: r.serviceId,
        name: r.serviceName,
        color: r.serviceColor,
        isGroup: r.serviceIsGroup,
        maxPatients: r.serviceMaxPatients,
      },
      room: { id: r.roomId, name: r.roomName },
      // null: a class session without a physio yet
      physio: r.physioId ? { userId: r.physioId, name: r.physioName ?? "" } : null,
      patients: patients
        .filter((p) => p.appointmentId === r.id)
        .map(({ appointmentId: _appointmentId, suggestedId, suggestedFirst, suggestedLast, ...p }) => ({
          ...p,
          suggestedPatient:
            !p.patientId && suggestedId && suggestedFirst
              ? { id: suggestedId, name: `${suggestedFirst} ${suggestedLast}` }
              : null,
          reminder: reminderStates.get(r.id)?.get(p.id) ?? null,
        })),
      // Empty when everything is fine
      issues,
    };
  });
}

// Always called after the service was checked to be this clinic's; the clinic
// filter is a second lock
export async function serviceDuration(clinicId: string, serviceId: string) {
  const [svc] = await db
    .select({ durationMinutes: service.durationMinutes })
    .from(service)
    .where(and(eq(service.id, serviceId), eq(service.organizationId, clinicId)))
    .limit(1);
  if (!svc) throw new Error(`Service ${serviceId} not found in clinic ${clinicId}`);
  return svc.durationMinutes;
}

// Longest range one request can ask for (the calendar asks for a week, the
// reports for a month): stops anyone loading years of appointments at once
const MAX_RANGE_DAYS = 62;

// ---------- List ----------

// GET /clinic/calendar/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD (both days included)
export const listAppointments = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { from, to } = req.query;
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
    return send(res, 400, "INVALID_RANGE", "from y to deben ser fechas AAAA-MM-DD, y to no anterior a from");
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) {
    return send(res, 400, "RANGE_TOO_LONG", `Como máximo ${MAX_RANGE_DAYS} días por consulta`);
  }

  const timeZone = await loadTimezone(clinicId);
  const appointments = await loadAppointments(clinicId, timeZone, {
    from: zonedToUtc(from, "00:00", timeZone),
    to: zonedToUtc(addDaysIso(to, 1), "00:00", timeZone),
  });
  res.json({ appointments });
};

// ---------- Create ----------

// POST /clinic/calendar/appointments -> 201 { appointment }
// body: { serviceId, roomId, physioId, date, startTime,
//         patients: [{ patientId } | { firstName, lastName }],
//         status?: "booked" | "confirmed", notes? }
// Patients sent by name are kept on the appointment only, without ficha
export const createAppointment = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { serviceId, roomId, physioId, date, startTime, status = "booked", notes } = req.body ?? {};

  if (typeof serviceId !== "string" || typeof roomId !== "string" || typeof physioId !== "string") {
    return send(res, 400, "INVALID_APPOINTMENT", "Elige servicio, sala y fisio");
  }
  if (!isIsoDate(date) || !isTime(startTime)) {
    return send(res, 400, "INVALID_DATE", "La fecha debe ser AAAA-MM-DD y la hora HH:MM");
  }
  if (status !== "booked" && status !== "confirmed") {
    return send(res, 400, "INVALID_STATUS", "Una cita nueva solo puede estar reservada o confirmada");
  }
  const patients = parsePatients(req.body?.patients);
  if (!patients) return send(res, 400, "INVALID_PATIENTS", INVALID_PATIENTS);
  const fichas = await loadFichas(clinicId, patients);
  if (!fichas) return send(res, 400, "PATIENT_NOT_FOUND", UNKNOWN_PATIENT);
  // Physios only book their own appointments
  if (!canManageAll(req) && physioId !== req.user!.id) {
    return send(res, 403, "ONLY_OWN_APPOINTMENTS", "Solo puedes crear citas para ti");
  }

  const timeZone = await loadTimezone(clinicId);
  const startsAt = zonedToUtc(date, startTime, timeZone);

  const ruleError = await checkAppointmentRules({
    clinicId,
    serviceId,
    roomId,
    physioId,
    date,
    startTime,
    startsAt,
    patientCount: patients.length,
  });
  if (ruleError) return send(res, ruleError.status, ruleError.code, ruleError.message);

  const endsAt = new Date(
    startsAt.getTime() + (await serviceDuration(clinicId, serviceId)) * 60000,
  );

  try {
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(appointment)
        .values({
          organizationId: clinicId,
          serviceId,
          roomId,
          physioId,
          startsAt,
          endsAt,
          status,
          notes: optionalText(notes),
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        })
        .returning({ id: appointment.id });

      await insertAppointmentPatients(
        tx,
        { clinicId, appointmentId: created!.id },
        patients,
        fichas,
      );

      await tx.insert(appointmentEvent).values({
        appointmentId: created!.id,
        organizationId: clinicId,
        type: "created",
        changedBy: req.user!.id,
      });
      return created!.id;
    });

    const [created] = await loadAppointments(clinicId, timeZone, { ids: [id] });
    res.status(201).json({ appointment: created });
  } catch (error) {
    // Two bookings for the same physio at the same moment: the database refuses the second
    if (isPhysioOverlapError(error)) {
      return send(res, 409, "PHYSIO_BUSY", "El fisio ya tiene una cita a esa hora");
    }
    throw error;
  }
};

// ---------- Update (also cancel / reactivate) ----------

// PATCH /clinic/calendar/appointments/:appointmentId -> { appointment }
// body: any of { date, startTime, serviceId, roomId, physioId, patients, status,
//                cancellationReason, notes }
export const updateAppointment = async (
  req: Request<{ appointmentId: string }>,
  res: Response,
) => {
  const clinicId = req.clinicId!;
  const { appointmentId } = req.params;
  const body = req.body ?? {};

  const [current] = await db
    .select()
    .from(appointment)
    .where(and(eq(appointment.id, appointmentId), eq(appointment.organizationId, clinicId)))
    .limit(1);
  if (!current) return notFound(res);

  const timeZone = await loadTimezone(clinicId);
  const currentLocal = utcToZoned(current.startsAt, timeZone);

  // Validate what was sent
  if (body.date !== undefined && !isIsoDate(body.date)) {
    return send(res, 400, "INVALID_DATE", "La fecha debe ser AAAA-MM-DD");
  }
  if (body.startTime !== undefined && !isTime(body.startTime)) {
    return send(res, 400, "INVALID_DATE", "La hora debe ser HH:MM");
  }
  for (const key of ["serviceId", "roomId", "physioId"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      return send(res, 400, "INVALID_APPOINTMENT", "Servicio, sala y fisio no son válidos");
    }
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return send(res, 400, "INVALID_STATUS", "El estado no es válido");
  }
  const patients = body.patients !== undefined ? parsePatients(body.patients) : undefined;
  if (patients === null) return send(res, 400, "INVALID_PATIENTS", INVALID_PATIENTS);
  const fichas = patients ? await loadFichas(clinicId, patients) : undefined;
  if (fichas === null) return send(res, 400, "PATIENT_NOT_FOUND", UNKNOWN_PATIENT);

  // The appointment after the change
  const next = {
    date: (body.date as string | undefined) ?? currentLocal.date,
    startTime: (body.startTime as string | undefined) ?? currentLocal.time,
    serviceId: (body.serviceId as string | undefined) ?? current.serviceId,
    roomId: (body.roomId as string | undefined) ?? current.roomId,
    physioId: (body.physioId as string | undefined) ?? current.physioId,
    status: (body.status as AppointmentStatus | undefined) ?? current.status,
  };

  // Physios only change their own appointments, and can't hand them to someone else
  if (!canManageAll(req) && (current.physioId !== req.user!.id || next.physioId !== req.user!.id)) {
    return send(
      res,
      403,
      "ONLY_OWN_APPOINTMENTS",
      current.physioId !== req.user!.id
        ? "Solo puedes modificar tus propias citas"
        : "No puedes pasar tu cita a otro fisio",
    );
  }

  // Cancelling needs a reason (the database requires it too)
  const cancellationReason =
    next.status === "cancelled"
      ? optionalText(body.cancellationReason) ?? current.cancellationReason
      : null;
  if (next.status === "cancelled" && !cancellationReason) {
    return send(res, 400, "REASON_REQUIRED", "Indica el motivo de la cancelación");
  }

  const currentPatientCount = (
    await db
      .select({ id: appointmentPatient.id })
      .from(appointmentPatient)
      .where(eq(appointmentPatient.appointmentId, appointmentId))
  ).length;

  const slotChanged =
    next.date !== currentLocal.date ||
    next.startTime !== currentLocal.time ||
    next.serviceId !== current.serviceId ||
    next.roomId !== current.roomId ||
    next.physioId !== current.physioId;
  const reactivated = current.status === "cancelled" && next.status !== "cancelled";
  const startsAt = zonedToUtc(next.date, next.startTime, timeZone);

  // Check the rules again if the slot, the patients or the status make it occupy time
  if (next.status !== "cancelled" && (slotChanged || reactivated || patients !== undefined)) {
    const ruleError = await checkAppointmentRules({
      clinicId,
      ...next,
      startsAt,
      patientCount: patients?.length ?? currentPatientCount,
      excludeAppointmentId: appointmentId,
      // A class session may be empty or have no physio yet
      classSession: await isClassSession(current.seriesId),
    });
    if (ruleError) return send(res, ruleError.status, ruleError.code, ruleError.message);
  } else if (slotChanged) {
    // Cancelled appointments skip the rules above (they don't occupy time), but
    // a changed service, room or physio must still be this clinic's. Otherwise
    // it could point at another clinic's data and show its names here.
    // Unchanged ones stay as they are even if since deactivated or gone (history)
    const { svc, rm, professional } = await loadParts(clinicId, next);
    if (next.serviceId !== current.serviceId && !svc) {
      return send(res, 400, "INVALID_SERVICE", "Ese servicio no existe en tu clínica");
    }
    if (next.roomId !== current.roomId && !rm) {
      return send(res, 400, "INVALID_ROOM", "Esa sala no existe en tu clínica");
    }
    if (next.physioId !== current.physioId && !professional) {
      return send(res, 400, "INVALID_PHYSIO", "Ese profesional no puede atender citas en tu clínica");
    }
  }

  const endsAt = new Date(
    startsAt.getTime() + (await serviceDuration(clinicId, next.serviceId)) * 60000,
  );

  // History: which fields changed
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const track = (field: string, from: unknown, to: unknown) => {
    if (from !== to) changes[field] = { from, to };
  };
  track("date", currentLocal.date, next.date);
  track("startTime", currentLocal.time, next.startTime);
  track("serviceId", current.serviceId, next.serviceId);
  track("roomId", current.roomId, next.roomId);
  track("physioId", current.physioId, next.physioId);
  const notes = body.notes !== undefined ? optionalText(body.notes) : current.notes;
  track("notes", current.notes, notes);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(appointment)
        .set({
          ...next,
          startsAt,
          endsAt,
          cancellationReason,
          cancelledAt:
            next.status === "cancelled" ? (current.cancelledAt ?? new Date()) : null,
          notes,
          // Moved to another day or time by hand: it stops following its series
          detached: current.detached || (!!current.seriesId && ("date" in changes || "startTime" in changes)),
          updatedBy: req.user!.id,
        })
        .where(eq(appointment.id, appointmentId));

      if (patients) {
        await syncAppointmentPatients(tx, { clinicId, appointmentId }, patients, fichas!);
      }

      const events: (typeof appointmentEvent.$inferInsert)[] = [];
      const base = { appointmentId, organizationId: clinicId, changedBy: req.user!.id };
      if (Object.keys(changes).length > 0) events.push({ ...base, type: "updated", changes });
      if (next.status !== current.status) {
        events.push({
          ...base,
          type: "status_changed",
          changes: { status: { from: current.status, to: next.status } },
        });
      }
      if (patients) events.push({ ...base, type: "patients_changed" });
      if (events.length > 0) await tx.insert(appointmentEvent).values(events);
    });
  } catch (error) {
    if (isPhysioOverlapError(error)) {
      return send(res, 409, "PHYSIO_BUSY", "El fisio ya tiene una cita a esa hora");
    }
    throw error;
  }

  const [updated] = await loadAppointments(clinicId, timeZone, { ids: [appointmentId] });
  res.json({ appointment: updated });
};

// ---------- Delete ----------

// DELETE /clinic/calendar/appointments/:appointmentId -> 204 (owners and admins).
// Usually it's better to cancel: that keeps the appointment in the history
export const deleteAppointment = async (
  req: Request<{ appointmentId: string }>,
  res: Response,
) => {
  const deleted = await db
    .delete(appointment)
    .where(
      and(
        eq(appointment.id, req.params.appointmentId),
        eq(appointment.organizationId, req.clinicId!),
      ),
    )
    .returning({ id: appointment.id });

  if (deleted.length === 0) return notFound(res);
  res.status(204).end();
};

// ---------- Linking an online booking to a ficha ----------

// POST /clinic/calendar/appointments/:appointmentId/patients/:rowId/link
// body: { patientId } -> 204   (or { dismiss: true }: "it's not them")
// Turns a patient without ficha (typically an online booking) into that ficha,
// in the same row: payments and attendance recorded on it stay (Cobros reads
// the patient from this row). Clinics with "Pacientes e historia clínica" only
export const linkAppointmentPatient = async (
  req: Request<{ appointmentId: string; rowId: string }>,
  res: Response,
) => {
  const clinicId = req.clinicId!;
  const { appointmentId, rowId } = req.params;
  if (!UUID_PATTERN.test(appointmentId) || !UUID_PATTERN.test(rowId)) return notFound(res);
  const [row] = await db
    .select({ id: appointmentPatient.id, patientId: appointmentPatient.patientId })
    .from(appointmentPatient)
    .where(
      and(
        eq(appointmentPatient.id, rowId),
        eq(appointmentPatient.appointmentId, appointmentId),
        eq(appointmentPatient.organizationId, clinicId),
      ),
    );
  if (!row) return notFound(res);

  if (req.body?.dismiss === true) {
    await db.update(appointmentPatient).set({ suggestedPatientId: null }).where(eq(appointmentPatient.id, row.id));
    res.status(204).end();
    return;
  }
  if (row.patientId) return send(res, 409, "ALREADY_LINKED", "Este paciente ya tiene ficha en la cita");
  const patientId = req.body?.patientId;
  if (typeof patientId !== "string" || !UUID_PATTERN.test(patientId)) {
    return send(res, 400, "INVALID_PATIENT", "Elige una ficha");
  }
  const [ficha] = await db
    .select({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })
    .from(patient)
    .where(and(eq(patient.id, patientId), eq(patient.organizationId, clinicId)));
  if (!ficha) return send(res, 404, "PATIENT_NOT_FOUND", UNKNOWN_PATIENT);
  const [inAppointment] = await db
    .select({ id: appointmentPatient.id })
    .from(appointmentPatient)
    .where(and(eq(appointmentPatient.appointmentId, appointmentId), eq(appointmentPatient.patientId, ficha.id)));
  if (inAppointment) return send(res, 409, "ALREADY_IN_APPOINTMENT", "Esa ficha ya está en la cita");

  await db.transaction(async (tx) => {
    await tx
      .update(appointmentPatient)
      .set({
        patientId: ficha.id,
        firstName: ficha.firstName,
        lastName: ficha.lastName,
        contactEmail: null,
        suggestedPatientId: null,
      })
      .where(eq(appointmentPatient.id, row.id));
    await tx.insert(appointmentEvent).values({
      appointmentId,
      organizationId: clinicId,
      type: "patients_changed",
      changes: { linked: { from: null, to: ficha.id } },
      changedBy: req.user!.id,
    });
  });
  res.status(204).end();
};

// ---------- Weekly series (R1) ----------

// Whether an appointment's series is a group class (R3)
async function isClassSession(seriesId: string | null) {
  if (!seriesId) return false;
  const [found] = await db
    .select({ kind: appointmentSeries.kind })
    .from(appointmentSeries)
    .where(eq(appointmentSeries.id, seriesId));
  return found?.kind === "class";
}

// Longest series: half a year, at most 100 appointments
export const MAX_SERIES_DAYS = 183;
export const MAX_SERIES_APPOINTMENTS = 100;

type SeriesInput = {
  serviceId: string;
  roomId: string;
  physioId: string;
  startTime: string;
  weekdays: number[];
  startsOn: string;
  endsOn: string;
  patients: PatientInput[];
  fichas: Map<string, Names>;
  status: "booked" | "confirmed";
  notes: string | null;
};

// The days of a series: every chosen weekday from startsOn to endsOn
export function seriesDates(startsOn: string, endsOn: string, weekdays: number[]) {
  const days: string[] = [];
  for (let d = startsOn; d <= endsOn; d = addDaysIso(d, 1)) {
    if (weekdays.includes(isoWeekdayOf(d))) days.push(d);
  }
  return days;
}

// Body of preview/create -> the input, or an error to send
async function parseSeries(req: Request): Promise<SeriesInput | { status: 400 | 403; code: string; message: string }> {
  const clinicId = req.clinicId!;
  const b = req.body ?? {};
  if (typeof b.serviceId !== "string" || typeof b.roomId !== "string" || typeof b.physioId !== "string") {
    return { status: 400, code: "INVALID_APPOINTMENT", message: "Elige servicio, sala y fisio" };
  }
  if (!isTime(b.startTime) || !isIsoDate(b.startsOn) || !isIsoDate(b.endsOn) || b.endsOn < b.startsOn) {
    return { status: 400, code: "INVALID_DATE", message: "Indica la hora, el primer día y el último" };
  }
  if (addDaysIso(b.startsOn, MAX_SERIES_DAYS) < b.endsOn) {
    return { status: 400, code: "SERIES_TOO_LONG", message: "Como mucho seis meses: crea otra serie después" };
  }
  const weekdays = Array.isArray(b.weekdays) ? [...new Set(b.weekdays)] : [];
  if (weekdays.length === 0 || !weekdays.every((w) => Number.isInteger(w) && (w as number) >= 1 && (w as number) <= 7)) {
    return { status: 400, code: "INVALID_WEEKDAYS", message: "Elige al menos un día de la semana" };
  }
  const status = b.status === "confirmed" ? "confirmed" : "booked";
  const patients = parsePatients(b.patients);
  if (!patients) return { status: 400, code: "INVALID_PATIENTS", message: INVALID_PATIENTS };
  // An individual series needs its patient; a group one can start empty
  if (patients.length === 0) {
    const [svc] = await db
      .select({ isGroup: service.isGroup })
      .from(service)
      .where(and(eq(service.id, b.serviceId), eq(service.organizationId, clinicId)));
    if (!svc?.isGroup) return { status: 400, code: "NO_PATIENTS", message: "Añade al menos un paciente" };
  }
  const fichas = await loadFichas(clinicId, patients);
  if (!fichas) return { status: 400, code: "PATIENT_NOT_FOUND", message: UNKNOWN_PATIENT };
  if (!canManageAll(req) && b.physioId !== req.user!.id) {
    return { status: 403, code: "ONLY_OWN_APPOINTMENTS", message: "Solo puedes crear citas para ti" };
  }
  return {
    serviceId: b.serviceId,
    roomId: b.roomId,
    physioId: b.physioId,
    startTime: b.startTime,
    weekdays: (weekdays as number[]).sort(),
    startsOn: b.startsOn,
    endsOn: b.endsOn,
    patients,
    fichas,
    status,
    notes: optionalText(b.notes),
  };
}

// Each day of the series with whether it can be booked, and why not (the same
// rules as a single appointment: hours and holidays, room, physio…)
async function checkSeriesDays(clinicId: string, input: SeriesInput) {
  const timeZone = await loadTimezone(clinicId);
  const now = new Date();
  const days = seriesDates(input.startsOn, input.endsOn, input.weekdays);
  const result: { date: string; ok: boolean; code: string | null; message: string | null }[] = [];
  for (const date of days) {
    const startsAt = zonedToUtc(date, input.startTime, timeZone);
    if (startsAt < now) {
      result.push({ date, ok: false, code: "PAST", message: "Ya ha pasado" });
      continue;
    }
    const error = await checkAppointmentRules({
      clinicId,
      serviceId: input.serviceId,
      roomId: input.roomId,
      physioId: input.physioId,
      date,
      startTime: input.startTime,
      startsAt,
      patientCount: input.patients.length,
    });
    result.push({ date, ok: !error, code: error?.code ?? null, message: error?.message ?? null });
  }
  return { days: result, timeZone };
}

// POST /clinic/calendar/series/preview -> { days: [{ date, ok, code, message }] }
// body: { serviceId, roomId, physioId, startTime, weekdays: [1..7], startsOn, endsOn, patients }
export const previewSeries = async (req: Request, res: Response) => {
  const input = await parseSeries(req);
  if ("code" in input) return send(res, input.status, input.code, input.message);
  const { days } = await checkSeriesDays(req.clinicId!, input);
  if (days.length > MAX_SERIES_APPOINTMENTS) {
    return send(res, 400, "SERIES_TOO_LONG", `Como mucho ${MAX_SERIES_APPOINTMENTS} citas por serie`);
  }
  res.json({ days });
};

// POST /clinic/calendar/series -> 201 { seriesId, created: [dates], skipped: [{ date, message }] }
// body: the same as preview, plus status? and notes?. Creates the days that
// can be booked and skips the others (each one checked again now)
export const createSeries = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const input = await parseSeries(req);
  if ("code" in input) return send(res, input.status, input.code, input.message);
  const { days, timeZone } = await checkSeriesDays(clinicId, input);
  if (days.length > MAX_SERIES_APPOINTMENTS) {
    return send(res, 400, "SERIES_TOO_LONG", `Como mucho ${MAX_SERIES_APPOINTMENTS} citas por serie`);
  }
  if (!days.some((d) => d.ok)) {
    return send(res, 409, "NOTHING_TO_BOOK", "Ninguno de esos días se puede reservar");
  }
  const duration = await serviceDuration(clinicId, input.serviceId);
  const skipped = days.filter((d) => !d.ok).map((d) => ({ date: d.date, message: d.message }));
  const created: string[] = [];

  const seriesId = await db.transaction(async (tx) => {
    const [series] = await tx
      .insert(appointmentSeries)
      .values({
        organizationId: clinicId,
        kind: "individual",
        serviceId: input.serviceId,
        roomId: input.roomId,
        physioId: input.physioId,
        weekdays: input.weekdays,
        startTime: input.startTime,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        createdBy: req.user!.id,
      })
      .returning({ id: appointmentSeries.id });

    for (const day of days.filter((d) => d.ok)) {
      const startsAt = zonedToUtc(day.date, input.startTime, timeZone);
      try {
        // A savepoint per day: if someone took the physio's slot meanwhile,
        // only that day is skipped
        await tx.transaction(async (one) => {
          const [a] = await one
            .insert(appointment)
            .values({
              organizationId: clinicId,
              serviceId: input.serviceId,
              roomId: input.roomId,
              physioId: input.physioId,
              startsAt,
              endsAt: new Date(startsAt.getTime() + duration * 60000),
              status: input.status,
              notes: input.notes,
              seriesId: series!.id,
              createdBy: req.user!.id,
              updatedBy: req.user!.id,
            })
            .returning({ id: appointment.id });
          await insertAppointmentPatients(one, { clinicId, appointmentId: a!.id }, input.patients, input.fichas);
          await one.insert(appointmentEvent).values({
            appointmentId: a!.id,
            organizationId: clinicId,
            type: "created",
            changedBy: req.user!.id,
          });
        });
        created.push(day.date);
      } catch (error) {
        if (!isPhysioOverlapError(error)) throw error;
        skipped.push({ date: day.date, message: "El fisio ya tiene una cita a esa hora" });
      }
    }
    return series!.id;
  });

  res.status(201).json({ seriesId, created, skipped: skipped.sort((a, b) => a.date.localeCompare(b.date)) });
};

// POST /clinic/calendar/series/:seriesId/update
// body: { fromAppointmentId?, scope: "following" | "all",
//         changes: { startTime?, physioId?, roomId?, patients?, notes? } | { cancel: { reason } } }
// -> { updated: [dates], skipped: [{ date, message }] }
// Changes "this one and the following" (from fromAppointmentId) or "all" the
// appointments of a series. Only future ones, not cancelled, not changed by
// hand (detached). Each one is checked again with the calendar rules: those
// that don't fit are skipped and listed
export const updateSeries = async (req: Request<{ seriesId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { seriesId } = req.params;
  if (!UUID_PATTERN.test(seriesId)) return notFound(res);
  const body = req.body ?? {};
  const scope = body.scope;
  if (scope !== "following" && scope !== "all") {
    return send(res, 400, "INVALID_SCOPE", "Elige si es esta y las siguientes o todas");
  }
  const [series] = await db
    .select()
    .from(appointmentSeries)
    .where(
      and(eq(appointmentSeries.id, seriesId), eq(appointmentSeries.organizationId, clinicId), isNull(appointmentSeries.deletedAt)),
    );
  if (!series) return notFound(res);

  // From which appointment ("following"), or from now ("all": past ones stay)
  const now = new Date();
  let from = now;
  if (scope === "following") {
    const fromId = body.fromAppointmentId;
    if (typeof fromId !== "string" || !UUID_PATTERN.test(fromId)) return notFound(res);
    const [start] = await db
      .select({ startsAt: appointment.startsAt })
      .from(appointment)
      .where(and(eq(appointment.id, fromId), eq(appointment.seriesId, seriesId)));
    if (!start) return notFound(res);
    from = start.startsAt > now ? start.startsAt : now;
  }
  const targets = await db
    .select()
    .from(appointment)
    .where(
      and(
        eq(appointment.organizationId, clinicId),
        eq(appointment.seriesId, seriesId),
        eq(appointment.detached, false),
        ne(appointment.status, "cancelled"),
        gte(appointment.startsAt, from),
      ),
    )
    .orderBy(asc(appointment.startsAt));
  // Physios only change their own appointments
  if (!canManageAll(req) && targets.some((t) => t.physioId !== req.user!.id)) {
    return send(res, 403, "ONLY_OWN_APPOINTMENTS", "Solo puedes cambiar tus citas");
  }

  const timeZone = await loadTimezone(clinicId);
  const updated: string[] = [];
  const skipped: { date: string; message: string }[] = [];

  // Cancelling them
  const cancel = body.changes?.cancel;
  if (cancel) {
    const reason = optionalText(cancel.reason);
    if (!reason) return send(res, 400, "REASON_REQUIRED", "Escribe el motivo de la cancelación");
    await db.transaction(async (tx) => {
      for (const t of targets) {
        await tx
          .update(appointment)
          .set({ status: "cancelled", cancellationReason: reason, cancelledAt: now, updatedBy: req.user!.id })
          .where(eq(appointment.id, t.id));
        await tx.insert(appointmentEvent).values({
          appointmentId: t.id,
          organizationId: clinicId,
          type: "status_changed",
          changes: { status: { from: t.status, to: "cancelled" } },
          changedBy: req.user!.id,
        });
        updated.push(utcToZoned(t.startsAt, timeZone).date);
      }
    });
    res.json({ updated, skipped });
    return;
  }

  // Changing time, physio, room, patients or notes
  const c = body.changes ?? {};
  if (c.startTime !== undefined && !isTime(c.startTime)) return send(res, 400, "INVALID_DATE", "Hora no válida");
  if (c.physioId !== undefined && typeof c.physioId !== "string") return send(res, 400, "INVALID_PHYSIO", "Fisio no válido");
  if (c.roomId !== undefined && typeof c.roomId !== "string") return send(res, 400, "INVALID_ROOM", "Sala no válida");
  if (!canManageAll(req) && c.physioId !== undefined && c.physioId !== req.user!.id) {
    return send(res, 403, "ONLY_OWN_APPOINTMENTS", "Solo puedes dar citas para ti");
  }
  const patients = c.patients !== undefined ? parsePatients(c.patients) : undefined;
  if (patients === null) return send(res, 400, "INVALID_PATIENTS", INVALID_PATIENTS);
  const fichas = patients ? await loadFichas(clinicId, patients) : undefined;
  if (fichas === null) return send(res, 400, "PATIENT_NOT_FOUND", UNKNOWN_PATIENT);
  const notes = c.notes !== undefined ? optionalText(c.notes) : undefined;

  const counts = await db
    .select({ id: appointmentPatient.appointmentId, n: sql<number>`count(*)::int` })
    .from(appointmentPatient)
    .where(inArray(appointmentPatient.appointmentId, targets.length ? targets.map((t) => t.id) : [seriesId]))
    .groupBy(appointmentPatient.appointmentId);

  for (const t of targets) {
    const local = utcToZoned(t.startsAt, timeZone);
    const startTime = c.startTime ?? local.time;
    const startsAt = zonedToUtc(local.date, startTime, timeZone);
    const next = {
      physioId: c.physioId ?? t.physioId,
      roomId: c.roomId ?? t.roomId,
    };
    const error = await checkAppointmentRules({
      clinicId,
      serviceId: t.serviceId,
      roomId: next.roomId,
      physioId: next.physioId,
      date: local.date,
      startTime,
      startsAt,
      patientCount: patients?.length ?? counts.find((x) => x.id === t.id)?.n ?? 0,
      excludeAppointmentId: t.id,
      classSession: series.kind === "class",
    });
    if (error) {
      skipped.push({ date: local.date, message: error.message });
      continue;
    }
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(appointment)
          .set({
            ...next,
            startsAt,
            endsAt: new Date(startsAt.getTime() + (t.endsAt.getTime() - t.startsAt.getTime())),
            ...(notes !== undefined ? { notes } : {}),
            updatedBy: req.user!.id,
          })
          .where(eq(appointment.id, t.id));
        if (patients) await syncAppointmentPatients(tx, { clinicId, appointmentId: t.id }, patients, fichas!);
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        if (startTime !== local.time) changes.startTime = { from: local.time, to: startTime };
        if (next.physioId !== t.physioId) changes.physioId = { from: t.physioId, to: next.physioId };
        if (next.roomId !== t.roomId) changes.roomId = { from: t.roomId, to: next.roomId };
        if (notes !== undefined && notes !== t.notes) changes.notes = { from: t.notes, to: notes };
        const base = { appointmentId: t.id, organizationId: clinicId, changedBy: req.user!.id };
        if (Object.keys(changes).length) await tx.insert(appointmentEvent).values({ ...base, type: "updated", changes });
        if (patients) await tx.insert(appointmentEvent).values({ ...base, type: "patients_changed" });
      });
      updated.push(local.date);
    } catch (error) {
      if (!isPhysioOverlapError(error)) throw error;
      skipped.push({ date: local.date, message: "El fisio ya tiene una cita a esa hora" });
    }
  }

  // The series remembers the new time, physio and room for "all"
  if (scope === "all" && (c.startTime || c.physioId || c.roomId)) {
    await db
      .update(appointmentSeries)
      .set({
        ...(c.startTime ? { startTime: c.startTime } : {}),
        ...(c.physioId ? { physioId: c.physioId } : {}),
        ...(c.roomId ? { roomId: c.roomId } : {}),
      })
      .where(eq(appointmentSeries.id, seriesId));
  }
  res.json({ updated, skipped });
};

// ---------- Group classes (R3) ----------

// A class: a weekly series of a group service with enrolled members. Its
// sessions are appointments; each member is a patient of every session from
// the day they joined until they leave, while there are places

type ClassInput = {
  serviceId: string;
  roomId: string;
  physioId: string | null;
  startTime: string;
  weekdays: number[];
  startsOn: string;
  endsOn: string;
  members: PatientInput[];
  fichas: Map<string, Names>;
};

async function parseClass(req: Request): Promise<ClassInput | { status: 400 | 403; code: string; message: string }> {
  const clinicId = req.clinicId!;
  const b = req.body ?? {};
  if (typeof b.serviceId !== "string" || typeof b.roomId !== "string") {
    return { status: 400, code: "INVALID_CLASS", message: "Elige servicio y sala" };
  }
  if (b.physioId !== null && b.physioId !== undefined && typeof b.physioId !== "string") {
    return { status: 400, code: "INVALID_PHYSIO", message: "Fisio no válido" };
  }
  if (!canManageAll(req)) {
    return { status: 403, code: "FORBIDDEN", message: "Solo propietarios, administradores y recepción crean clases" };
  }
  const [svc] = await db
    .select({ isGroup: service.isGroup })
    .from(service)
    .where(and(eq(service.id, b.serviceId), eq(service.organizationId, clinicId)));
  if (!svc) return { status: 400, code: "INVALID_SERVICE", message: "Ese servicio no existe en tu clínica" };
  if (!svc.isGroup) return { status: 400, code: "NOT_A_GROUP", message: "Las clases son de servicios en grupo" };
  if (!isTime(b.startTime) || !isIsoDate(b.startsOn) || !isIsoDate(b.endsOn) || b.endsOn < b.startsOn) {
    return { status: 400, code: "INVALID_DATE", message: "Indica la hora, el primer día y el último" };
  }
  if (addDaysIso(b.startsOn, MAX_SERIES_DAYS) < b.endsOn) {
    return { status: 400, code: "SERIES_TOO_LONG", message: "Como mucho seis meses: amplíala después" };
  }
  const weekdays = Array.isArray(b.weekdays) ? [...new Set(b.weekdays)] : [];
  if (weekdays.length === 0 || !weekdays.every((w) => Number.isInteger(w) && (w as number) >= 1 && (w as number) <= 7)) {
    return { status: 400, code: "INVALID_WEEKDAYS", message: "Elige al menos un día de la semana" };
  }
  const members = b.members === undefined ? [] : parsePatients(b.members);
  if (!members) return { status: 400, code: "INVALID_PATIENTS", message: INVALID_PATIENTS };
  const fichas = await loadFichas(clinicId, members);
  if (!fichas) return { status: 400, code: "PATIENT_NOT_FOUND", message: UNKNOWN_PATIENT };
  return {
    serviceId: b.serviceId,
    roomId: b.roomId,
    physioId: b.physioId || null,
    startTime: b.startTime,
    weekdays: (weekdays as number[]).sort(),
    startsOn: b.startsOn,
    endsOn: b.endsOn,
    members,
    fichas,
  };
}

async function checkClassDays(clinicId: string, input: ClassInput, from = input.startsOn) {
  const timeZone = await loadTimezone(clinicId);
  const now = new Date();
  const result: { date: string; ok: boolean; code: string | null; message: string | null }[] = [];
  for (const date of seriesDates(from, input.endsOn, input.weekdays)) {
    const startsAt = zonedToUtc(date, input.startTime, timeZone);
    if (startsAt < now) {
      result.push({ date, ok: false, code: "PAST", message: "Ya ha pasado" });
      continue;
    }
    const error = await checkAppointmentRules({
      clinicId,
      serviceId: input.serviceId,
      roomId: input.roomId,
      physioId: input.physioId,
      date,
      startTime: input.startTime,
      startsAt,
      patientCount: input.members.length,
      classSession: true,
    });
    result.push({ date, ok: !error, code: error?.code ?? null, message: error?.message ?? null });
  }
  return { days: result, timeZone };
}

// The members of a class who go on a given day
export const membersOn = (members: (typeof seriesMember.$inferSelect)[], date: string) =>
  members.filter((m) => m.fromDate <= date && (!m.toDate || m.toDate >= date));

export const memberAsPatient = (m: typeof seriesMember.$inferSelect): PatientInput =>
  m.patientId ? { patientId: m.patientId } : { firstName: m.firstName, lastName: m.lastName, contactEmail: m.contactEmail };

// Creates the sessions of a class on the given days, with its members
async function createClassSessions(
  tx: Tx,
  req: Request,
  series: typeof appointmentSeries.$inferSelect,
  days: string[],
  timeZone: string,
) {
  const clinicId = req.clinicId!;
  const duration = await serviceDuration(clinicId, series.serviceId);
  const members = await tx.select().from(seriesMember).where(eq(seriesMember.seriesId, series.id));
  const fichas = await loadFichas(clinicId, members.map(memberAsPatient));
  const created: string[] = [];
  const skipped: { date: string; message: string }[] = [];
  for (const date of days) {
    const startsAt = zonedToUtc(date, series.startTime, timeZone);
    const going = membersOn(members, date).map(memberAsPatient);
    try {
      await tx.transaction(async (one) => {
        const [a] = await one
          .insert(appointment)
          .values({
            organizationId: clinicId,
            serviceId: series.serviceId,
            roomId: series.roomId,
            physioId: series.physioId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + duration * 60000),
            status: "booked",
            seriesId: series.id,
            createdBy: req.user!.id,
            updatedBy: req.user!.id,
          })
          .returning({ id: appointment.id });
        if (going.length > 0) {
          await insertAppointmentPatients(one, { clinicId, appointmentId: a!.id }, going, fichas ?? new Map());
        }
        await one.insert(appointmentEvent).values({
          appointmentId: a!.id,
          organizationId: clinicId,
          type: "created",
          changedBy: req.user!.id,
        });
      });
      created.push(date);
    } catch (error) {
      if (!isPhysioOverlapError(error)) throw error;
      skipped.push({ date, message: "El fisio ya tiene una cita a esa hora" });
    }
  }
  return { created, skipped };
}

// POST /clinic/calendar/classes/preview -> { days }
// body: { serviceId, roomId, physioId?, startTime, weekdays, startsOn, endsOn, members? }
export const previewClass = async (req: Request, res: Response) => {
  const input = await parseClass(req);
  if ("code" in input) return send(res, input.status, input.code, input.message);
  const { days } = await checkClassDays(req.clinicId!, input);
  if (days.length > MAX_SERIES_APPOINTMENTS) {
    return send(res, 400, "SERIES_TOO_LONG", `Como mucho ${MAX_SERIES_APPOINTMENTS} sesiones de una vez`);
  }
  res.json({ days });
};

// POST /clinic/calendar/classes -> 201 { classId, created, skipped }
// Without physio (physioId null) it's created anyway: assign one later
export const createClass = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const input = await parseClass(req);
  if ("code" in input) return send(res, input.status, input.code, input.message);
  const { days, timeZone } = await checkClassDays(clinicId, input);
  if (days.length > MAX_SERIES_APPOINTMENTS) {
    return send(res, 400, "SERIES_TOO_LONG", `Como mucho ${MAX_SERIES_APPOINTMENTS} sesiones de una vez`);
  }
  if (!days.some((d) => d.ok)) return send(res, 409, "NOTHING_TO_BOOK", "Ninguno de esos días se puede reservar");

  const result = await db.transaction(async (tx) => {
    const [series] = await tx
      .insert(appointmentSeries)
      .values({
        organizationId: clinicId,
        kind: "class",
        serviceId: input.serviceId,
        roomId: input.roomId,
        physioId: input.physioId,
        weekdays: input.weekdays,
        startTime: input.startTime,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        createdBy: req.user!.id,
      })
      .returning();
    if (input.members.length > 0) {
      await tx.insert(seriesMember).values(
        input.members.map((m) => ({
          organizationId: clinicId,
          seriesId: series!.id,
          ...("patientId" in m
            ? { patientId: m.patientId, ...input.fichas.get(m.patientId)! }
            : { firstName: m.firstName, lastName: m.lastName, contactEmail: m.contactEmail ?? null }),
          fromDate: input.startsOn,
          createdBy: req.user!.id,
        })),
      );
    }
    const sessions = await createClassSessions(tx, req, series!, days.filter((d) => d.ok).map((d) => d.date), timeZone);
    return { classId: series!.id, ...sessions };
  });
  const skipped = [...days.filter((d) => !d.ok).map((d) => ({ date: d.date, message: d.message })), ...result.skipped];
  res.status(201).json({ classId: result.classId, created: result.created, skipped });
};

// GET /clinic/calendar/classes -> { classes }
// The clinic's classes with their members (still enrolled) and next sessions
export const listClasses = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const now = new Date();
  const rows = await db
    .select({
      series: appointmentSeries,
      serviceName: service.name,
      serviceColor: service.color,
      maxPatients: service.maxPatients,
      roomName: room.name,
      roomCapacity: room.capacity,
      physioName: user.name,
    })
    .from(appointmentSeries)
    .innerJoin(service, eq(appointmentSeries.serviceId, service.id))
    .innerJoin(room, eq(appointmentSeries.roomId, room.id))
    .leftJoin(user, eq(appointmentSeries.physioId, user.id))
    .where(
      and(
        eq(appointmentSeries.organizationId, clinicId),
        eq(appointmentSeries.kind, "class"),
        isNull(appointmentSeries.deletedAt),
      ),
    )
    .orderBy(asc(appointmentSeries.startTime));
  if (rows.length === 0) return res.json({ classes: [] });
  const ids = rows.map((r) => r.series.id);
  const members = await db
    .select({ member: seriesMember, currentFirst: patient.firstName, currentLast: patient.lastName })
    .from(seriesMember)
    .leftJoin(patient, eq(seriesMember.patientId, patient.id))
    .where(and(eq(seriesMember.organizationId, clinicId), inArray(seriesMember.seriesId, ids)))
    .orderBy(asc(seriesMember.createdAt));
  const upcoming = await db
    .select({
      seriesId: appointment.seriesId,
      count: sql<number>`count(*)::int`,
      next: sql<Date>`min(${appointment.startsAt})`.mapWith((v) => new Date(v)),
      last: sql<Date>`max(${appointment.startsAt})`.mapWith((v) => new Date(v)),
      noPhysio: sql<number>`count(*) filter (where ${appointment.physioId} is null)::int`,
    })
    .from(appointment)
    .where(
      and(
        inArray(appointment.seriesId, ids),
        ne(appointment.status, "cancelled"),
        gte(appointment.startsAt, now),
      ),
    )
    .groupBy(appointment.seriesId);
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(now, timeZone).date;
  res.json({
    classes: rows.map((r) => {
      const u = upcoming.find((x) => x.seriesId === r.series.id);
      return {
        id: r.series.id,
        service: { id: r.series.serviceId, name: r.serviceName, color: r.serviceColor },
        room: { id: r.series.roomId, name: r.roomName },
        physio: r.series.physioId ? { userId: r.series.physioId, name: r.physioName ?? "" } : null,
        weekdays: r.series.weekdays,
        startTime: r.series.startTime,
        startsOn: r.series.startsOn,
        endsOn: r.series.endsOn,
        places: Math.min(r.maxPatients, r.roomCapacity),
        members: members
          .filter((m) => m.member.seriesId === r.series.id && (!m.member.toDate || m.member.toDate >= today))
          .map(({ member: m, currentFirst, currentLast }) => ({
            id: m.id,
            patientId: m.patientId,
            firstName: currentFirst ?? m.firstName,
            lastName: currentLast ?? m.lastName,
            contactEmail: m.contactEmail,
            fromDate: m.fromDate,
            toDate: m.toDate,
          })),
        upcomingSessions: u?.count ?? 0,
        sessionsWithoutPhysio: u?.noPhysio ?? 0,
        nextSession: u ? utcToZoned(u.next, timeZone).date : null,
        lastSession: u ? utcToZoned(u.last, timeZone).date : null,
      };
    }),
  });
};

export async function loadClass(req: Request<{ classId: string }>) {
  if (!UUID_PATTERN.test(req.params.classId)) return null;
  const [found] = await db
    .select()
    .from(appointmentSeries)
    .where(
      and(
        eq(appointmentSeries.id, req.params.classId),
        eq(appointmentSeries.organizationId, req.clinicId!),
        eq(appointmentSeries.kind, "class"),
        isNull(appointmentSeries.deletedAt),
      ),
    );
  return found ?? null;
}

// The class's future sessions (not cancelled) from a day on, with their patients
async function futureSessions(clinicId: string, seriesId: string, fromDate: string, timeZone: string) {
  const from = zonedToUtc(fromDate, "00:00", timeZone);
  const now = new Date();
  const sessions = await db
    .select({ id: appointment.id, startsAt: appointment.startsAt, roomId: appointment.roomId, serviceId: appointment.serviceId })
    .from(appointment)
    .where(
      and(
        eq(appointment.organizationId, clinicId),
        eq(appointment.seriesId, seriesId),
        ne(appointment.status, "cancelled"),
        gte(appointment.startsAt, from > now ? from : now),
      ),
    )
    .orderBy(asc(appointment.startsAt));
  const rows = sessions.length
    ? await db
        .select({
          id: appointmentPatient.id,
          appointmentId: appointmentPatient.appointmentId,
          patientId: appointmentPatient.patientId,
          firstName: appointmentPatient.firstName,
          lastName: appointmentPatient.lastName,
        })
        .from(appointmentPatient)
        .where(inArray(appointmentPatient.appointmentId, sessions.map((x) => x.id)))
    : [];
  return sessions.map((x) => ({ ...x, patients: rows.filter((r) => r.appointmentId === x.id) }));
}

const samePerson = (
  row: { patientId: string | null; firstName: string; lastName: string },
  m: { patientId: string | null; firstName: string; lastName: string },
) =>
  m.patientId
    ? row.patientId === m.patientId
    : !row.patientId &&
      row.firstName.toLowerCase() === m.firstName.toLowerCase() &&
      row.lastName.toLowerCase() === m.lastName.toLowerCase();

// POST /clinic/calendar/classes/:classId/members   body: { patient, fromDate? }
// -> 201 { memberId, added: [dates], full: [dates] }
// Enrols someone: added to every future session from fromDate (default
// today) with a free place. Sessions already full are listed
export const addClassMember = async (req: Request<{ classId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  if (!canManageAll(req)) return send(res, 403, "FORBIDDEN", "Solo propietarios, administradores y recepción");
  const series = await loadClass(req);
  if (!series) return notFound(res);
  const parsed = parsePatients([req.body?.patient]);
  if (!parsed || parsed.length !== 1) return send(res, 400, "INVALID_PATIENTS", INVALID_PATIENTS);
  const fichas = await loadFichas(clinicId, parsed);
  if (!fichas) return send(res, 400, "PATIENT_NOT_FOUND", UNKNOWN_PATIENT);
  const input = parsed[0]!;
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(new Date(), timeZone).date;
  const fromDate = isIsoDate(req.body?.fromDate) ? (req.body.fromDate as string) : today;
  const person =
    "patientId" in input
      ? { patientId: input.patientId, ...fichas.get(input.patientId)!, contactEmail: null }
      : { patientId: null, firstName: input.firstName, lastName: input.lastName, contactEmail: input.contactEmail ?? null };

  const enrolled = await db
    .select()
    .from(seriesMember)
    .where(and(eq(seriesMember.seriesId, series.id), sql`(${seriesMember.toDate} is null or ${seriesMember.toDate} >= ${fromDate})`));
  if (enrolled.some((m) => samePerson(m, person))) {
    return send(res, 409, "ALREADY_ENROLLED", "Ya está inscrito en esta clase");
  }

  const sessions = await futureSessions(clinicId, series.id, fromDate, timeZone);
  const added: string[] = [];
  const full: string[] = [];
  const memberId = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(seriesMember)
      .values({ organizationId: clinicId, seriesId: series.id, ...person, fromDate, createdBy: req.user!.id })
      .returning({ id: seriesMember.id });
    for (const session of sessions) {
      const date = utcToZoned(session.startsAt, timeZone).date;
      if (session.patients.some((p) => samePerson(p, person))) continue; // already there (drop-in)
      const error = await checkAppointmentRules({
        clinicId,
        serviceId: session.serviceId,
        roomId: session.roomId,
        physioId: null,
        date,
        startTime: utcToZoned(session.startsAt, timeZone).time,
        startsAt: session.startsAt,
        patientCount: session.patients.length + 1,
        excludeAppointmentId: session.id,
        classSession: true,
      });
      if (error && ["TOO_MANY_PATIENTS", "ROOM_FULL"].includes(error.code)) {
        full.push(date);
        continue;
      }
      await insertAppointmentPatients(tx, { clinicId, appointmentId: session.id }, [input], fichas);
      await tx.insert(appointmentEvent).values({
        appointmentId: session.id,
        organizationId: clinicId,
        type: "patients_changed",
        changedBy: req.user!.id,
      });
      added.push(date);
    }
    return m!.id;
  });
  res.status(201).json({ memberId, added, full });
};

// POST /clinic/calendar/classes/:classId/members/:memberId/leave   body: { fromDate? }
// -> { removed: [dates] }
// From that day (default today) they no longer go: taken off those sessions.
// Payments or bono sessions on them go to review / back to the bono (Cobros)
export const removeClassMember = async (req: Request<{ classId: string; memberId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  if (!canManageAll(req)) return send(res, 403, "FORBIDDEN", "Solo propietarios, administradores y recepción");
  const series = await loadClass(req);
  if (!series || !UUID_PATTERN.test(req.params.memberId)) return notFound(res);
  const [m] = await db
    .select()
    .from(seriesMember)
    .where(and(eq(seriesMember.id, req.params.memberId), eq(seriesMember.seriesId, series.id)));
  if (!m) return notFound(res);
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(new Date(), timeZone).date;
  const fromDate = isIsoDate(req.body?.fromDate) ? (req.body.fromDate as string) : today;
  if (m.toDate && m.toDate < fromDate) return send(res, 409, "ALREADY_LEFT", "Ya no está en la clase");

  const sessions = await futureSessions(clinicId, series.id, fromDate, timeZone);
  const removed: string[] = [];
  await db.transaction(async (tx) => {
    await tx.update(seriesMember).set({ toDate: addDaysIso(fromDate, -1) }).where(eq(seriesMember.id, m.id));
    for (const session of sessions) {
      const row = session.patients.find((p) => samePerson(p, m));
      if (!row) continue;
      await tx.delete(appointmentPatient).where(eq(appointmentPatient.id, row.id));
      await tx.insert(appointmentEvent).values({
        appointmentId: session.id,
        organizationId: clinicId,
        type: "patients_changed",
        changedBy: req.user!.id,
      });
      removed.push(utcToZoned(session.startsAt, timeZone).date);
    }
  });
  res.json({ removed });
};

// POST /clinic/calendar/classes/:classId/extend   body: { endsOn } -> { created, skipped }
// Adds the sessions after the class's current last day, up to endsOn, with
// the members who go then (the same checks as when creating it)
export const extendClass = async (req: Request<{ classId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  if (!canManageAll(req)) return send(res, 403, "FORBIDDEN", "Solo propietarios, administradores y recepción");
  const series = await loadClass(req);
  if (!series) return notFound(res);
  const endsOn = req.body?.endsOn;
  if (!isIsoDate(endsOn) || endsOn <= series.endsOn) {
    return send(res, 400, "INVALID_DATE", "La nueva fecha de fin tiene que ser posterior a la actual");
  }
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(new Date(), timeZone).date;
  const from = addDaysIso(series.endsOn, 1) > today ? addDaysIso(series.endsOn, 1) : today;
  if (addDaysIso(from, MAX_SERIES_DAYS) < endsOn) {
    return send(res, 400, "SERIES_TOO_LONG", "Como mucho seis meses de una vez");
  }
  const members = await db.select().from(seriesMember).where(eq(seriesMember.seriesId, series.id));
  const input: ClassInput = {
    serviceId: series.serviceId,
    roomId: series.roomId,
    physioId: series.physioId,
    startTime: series.startTime,
    weekdays: series.weekdays,
    startsOn: series.startsOn,
    endsOn,
    members: membersOn(members, endsOn).map(memberAsPatient),
    fichas: new Map(),
  };
  const { days } = await checkClassDays(clinicId, input, from);
  const result = await db.transaction(async (tx) => {
    const sessions = await createClassSessions(tx, req, series, days.filter((d) => d.ok).map((d) => d.date), timeZone);
    await tx.update(appointmentSeries).set({ endsOn }).where(eq(appointmentSeries.id, series.id));
    return sessions;
  });
  res.json({
    created: result.created,
    skipped: [...days.filter((d) => !d.ok).map((d) => ({ date: d.date, message: d.message })), ...result.skipped],
  });
};

// PATCH /clinic/calendar/appointments/:appointmentId/attendance
// body: { rows: [{ rowId, attendance: "pending" | "attended" | "no_show" }] } -> 204
// Taking attendance in a group session (pasar lista): each patient on their own
export const setAttendance = async (req: Request<{ appointmentId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { appointmentId } = req.params;
  if (!UUID_PATTERN.test(appointmentId)) return notFound(res);
  const [current] = await db
    .select({ physioId: appointment.physioId, status: appointment.status })
    .from(appointment)
    .where(and(eq(appointment.id, appointmentId), eq(appointment.organizationId, clinicId)));
  if (!current) return notFound(res);
  if (!canManageAll(req) && current.physioId !== req.user!.id) {
    return send(res, 403, "ONLY_OWN_APPOINTMENTS", "Solo puedes pasar lista en tus sesiones");
  }
  if (current.status === "cancelled") return send(res, 409, "CANCELLED", "La sesión está cancelada");
  const rows = req.body?.rows;
  const valid = ["pending", "attended", "no_show"];
  if (
    !Array.isArray(rows) ||
    rows.length === 0 ||
    !rows.every((r) => typeof r?.rowId === "string" && UUID_PATTERN.test(r.rowId) && valid.includes(r.attendance))
  ) {
    return send(res, 400, "INVALID_ATTENDANCE", "Indica la asistencia de cada paciente");
  }
  await db.transaction(async (tx) => {
    for (const r of rows as { rowId: string; attendance: "pending" | "attended" | "no_show" }[]) {
      await tx
        .update(appointmentPatient)
        .set({ attendance: r.attendance })
        .where(
          and(
            eq(appointmentPatient.id, r.rowId),
            eq(appointmentPatient.appointmentId, appointmentId),
            eq(appointmentPatient.organizationId, clinicId),
          ),
        );
    }
    await tx.insert(appointmentEvent).values({
      appointmentId,
      organizationId: clinicId,
      type: "patients_changed",
      changes: { attendance: { from: null, to: rows.length } },
      changedBy: req.user!.id,
    });
  });
  res.status(204).end();
};
