import type { Request, Response } from "express";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
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
import { addDaysIso, utcToZoned, zonedToUtc } from "../lib/timezone.js";

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
const canManageAll = (req: Request) => MANAGE_ALL_ROLES.includes(req.clinicRole!);

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const notFound = (res: Response) =>
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
async function loadFichas(clinicId: string, patients: PatientInput[]) {
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
async function insertAppointmentPatients(
  tx: Tx,
  ids: { clinicId: string; appointmentId: string },
  patients: PatientInput[],
  fichas: Map<string, Names>,
) {
  const { clinicId: organizationId, appointmentId } = ids;
  await tx.insert(appointmentPatient).values(
    patients.map((p) =>
      "patientId" in p
        ? { ...fichas.get(p.patientId)!, patientId: p.patientId, appointmentId, organizationId }
        : { ...p, appointmentId, organizationId },
    ),
  );
}

const INVALID_PATIENTS =
  "Cada paciente necesita nombre y apellidos, no puede estar repetido y su email debe ser válido";
const UNKNOWN_PATIENT = "Alguno de los pacientes no existe en tu clínica";

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

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
    .innerJoin(user, eq(appointment.physioId, user.id))
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
    })
    .from(appointmentPatient)
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
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
      service: {
        id: r.serviceId,
        name: r.serviceName,
        color: r.serviceColor,
        isGroup: r.serviceIsGroup,
        maxPatients: r.serviceMaxPatients,
      },
      room: { id: r.roomId, name: r.roomName },
      physio: { userId: r.physioId, name: r.physioName },
      patients: patients
        .filter((p) => p.appointmentId === r.id)
        .map(({ appointmentId: _appointmentId, ...p }) => ({
          ...p,
          reminder: reminderStates.get(r.id)?.get(p.id) ?? null,
        })),
      // Empty when everything is fine
      issues,
    };
  });
}

// Always called after the service was checked to be this clinic's; the clinic
// filter is a second lock
async function serviceDuration(clinicId: string, serviceId: string) {
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
          updatedBy: req.user!.id,
        })
        .where(eq(appointment.id, appointmentId));

      if (patients) {
        await tx.delete(appointmentPatient).where(eq(appointmentPatient.appointmentId, appointmentId));
        await insertAppointmentPatients(
          tx,
          { clinicId, appointmentId },
          patients,
          fichas!,
        );
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
