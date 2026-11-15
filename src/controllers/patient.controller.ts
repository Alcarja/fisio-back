import type { Request, Response } from "express";
import { and, asc, count, desc, eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  patient,
  patientCase,
  service,
  user,
} from "../db/schema.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { isIsoDate } from "../lib/schedule.js";
import { utcToZoned } from "../lib/timezone.js";

// Pacientes of the active clinic. Every clinic role sees, creates and edits
// them; deleting is for owners and admins (patient.routes.ts).
// Only contact and administrative data here: the health data of the ficha
// (antecedentes, expedientes) is in clinical.controller.ts, for clinical roles.
// The clinic is always req.clinicId, set by requireActiveClinic from the session.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const notFound = (res: Response) =>
  send(res, 404, "PATIENT_NOT_FOUND", "Este paciente no existe en tu clínica");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with the usual separators, e.g. "+34 600 11 22 33"
const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;

// Fields sent to the frontend
const patientColumns = {
  id: patient.id,
  firstName: patient.firstName,
  lastName: patient.lastName,
  phone: patient.phone,
  email: patient.email,
  nif: patient.nif,
  address: patient.address,
  postalCode: patient.postalCode,
  city: patient.city,
  birthDate: patient.birthDate,
  notes: patient.notes,
  createdAt: patient.createdAt,
};

// ---------- Validation ----------

type PatientFields = Omit<typeof patient.$inferInsert, "organizationId">;

// Text fields with their longest allowed length. Empty text is saved as null
const TEXT_LIMITS = {
  phone: 30,
  email: 200,
  nif: 20,
  address: 200,
  postalCode: 12,
  city: 100,
  notes: 2000,
} as const;

// The fields that were sent, cleaned up. A string is the problem found.
// `partial`: editing, so the names may be left out
function parseFields(body: Record<string, unknown>, partial: boolean): Partial<PatientFields> | string {
  const fields: Partial<PatientFields> = {};

  for (const key of ["firstName", "lastName"] as const) {
    const value = body[key];
    if (value === undefined && partial) continue;
    if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
      return "El paciente necesita nombre y apellidos";
    }
    fields[key] = value.trim();
  }

  for (const [key, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") return `El campo ${key} no es válido`;
    const text = value?.trim() ?? "";
    if (text.length > max) return `El campo ${key} admite como máximo ${max} caracteres`;
    fields[key] = text || null;
  }
  if (fields.email && !EMAIL_PATTERN.test(fields.email)) return "El email no es válido";
  if (fields.phone && !PHONE_PATTERN.test(fields.phone)) return "El teléfono no es válido";
  if (fields.email) fields.email = fields.email.toLowerCase();
  if (fields.nif) fields.nif = fields.nif.toUpperCase();

  if (body.birthDate !== undefined) {
    const { birthDate } = body;
    if (birthDate === null || birthDate === "") fields.birthDate = null;
    else if (isIsoDate(birthDate) && birthDate <= new Date().toISOString().slice(0, 10)) {
      fields.birthDate = birthDate;
    } else return "La fecha de nacimiento no es válida";
  }

  return fields;
}

// ---------- Search ----------

// Lowercase and without accents, in SQL and in JS, so "garcia" finds "García"
const plainSql = (value: AnyColumn | SQL) =>
  sql`translate(lower(${value}), 'áéíóúüàèìòùñç', 'aeiouuaeiounc')`;
const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Every word must appear in the name, the phone, the email or the NIF
function searchFilter(search: string) {
  const words = plain(search).split(/\s+/).filter(Boolean).slice(0, 6);
  return words.map((word) => {
    // % and _ are wildcards in LIKE: search them as plain characters
    const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
    return or(
      sql`${plainSql(sql`${patient.firstName} || ' ' || ${patient.lastName}`)} like ${pattern}`,
      sql`replace(${patient.phone}, ' ', '') like ${pattern}`,
      sql`${patient.email} like ${pattern}`,
      sql`lower(${patient.nif}) like ${pattern}`,
    );
  });
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

// ---------- List ----------

// GET /clinic/patients?search=&limit= -> { patients, total }
// Ordered by surname. `total`: how many match in all, to offer "load more"
export const listPatients = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const requested = Number(req.query.limit);
  const limit =
    Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;

  const where = and(eq(patient.organizationId, clinicId), ...searchFilter(search));

  const [patients, [totals]] = await Promise.all([
    db
      .select(patientColumns)
      .from(patient)
      .where(where)
      .orderBy(asc(plainSql(patient.lastName)), asc(plainSql(patient.firstName)), asc(patient.id))
      .limit(limit),
    db.select({ total: count() }).from(patient).where(where),
  ]);

  res.json({ patients, total: totals?.total ?? 0 });
};

// ---------- Create ----------

// POST /clinic/patients -> 201 { patient }
export const createPatient = async (req: Request, res: Response) => {
  const fields = parseFields(req.body ?? {}, false);
  if (typeof fields === "string") return send(res, 400, "INVALID_PATIENT", fields);

  const [created] = await db
    .insert(patient)
    .values({
      ...(fields as PatientFields),
      organizationId: req.clinicId!,
      createdBy: req.user!.id,
    })
    .returning(patientColumns);

  res.status(201).json({ patient: created });
};

// ---------- One patient, with their appointments ----------

// Most recent appointments shown in the ficha
const HISTORY_LIMIT = 100;

// GET /clinic/patients/:patientId -> { patient: { ...fields, appointments } }
// appointments: newest first, in the clinic's local time
export const getPatient = async (req: Request<{ patientId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { patientId } = req.params;
  if (!UUID_PATTERN.test(patientId)) return notFound(res);

  const [found] = await db
    .select(patientColumns)
    .from(patient)
    .where(and(eq(patient.id, patientId), eq(patient.organizationId, clinicId)))
    .limit(1);
  if (!found) return notFound(res);

  const [timeZone, rows] = await Promise.all([
    loadTimezone(clinicId),
    db
      .select({
        id: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
        attendance: appointmentPatient.attendance,
        serviceName: service.name,
        serviceColor: service.color,
        physioName: user.name,
      })
      .from(appointmentPatient)
      .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
      .innerJoin(service, eq(appointment.serviceId, service.id))
      .innerJoin(user, eq(appointment.physioId, user.id))
      .where(
        and(
          eq(appointmentPatient.patientId, patientId),
          eq(appointmentPatient.organizationId, clinicId),
        ),
      )
      .orderBy(desc(appointment.startsAt))
      .limit(HISTORY_LIMIT),
  ]);

  res.json({
    patient: {
      ...found,
      appointments: rows.map((r) => {
        const start = utcToZoned(r.startsAt, timeZone);
        return {
          id: r.id,
          date: start.date,
          startTime: start.time,
          endTime: utcToZoned(r.endsAt, timeZone).time,
          // Already over (to tell past visits from upcoming ones)
          isPast: r.endsAt <= new Date(),
          status: r.status,
          attendance: r.attendance,
          serviceName: r.serviceName,
          serviceColor: r.serviceColor,
          physioName: r.physioName,
        };
      }),
    },
  });
};

// ---------- Update ----------

// PATCH /clinic/patients/:patientId -> { patient }. Only the fields sent change
export const updatePatient = async (req: Request<{ patientId: string }>, res: Response) => {
  const { patientId } = req.params;
  if (!UUID_PATTERN.test(patientId)) return notFound(res);

  const fields = parseFields(req.body ?? {}, true);
  if (typeof fields === "string") return send(res, 400, "INVALID_PATIENT", fields);
  if (Object.keys(fields).length === 0) {
    return send(res, 400, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }

  const [updated] = await db
    .update(patient)
    .set(fields)
    .where(and(eq(patient.id, patientId), eq(patient.organizationId, req.clinicId!)))
    .returning(patientColumns);

  if (!updated) return notFound(res);
  res.json({ patient: updated });
};

// ---------- Delete ----------

// DELETE /clinic/patients/:patientId -> 204 (owners and admins).
// Their appointments stay in the calendar with the name they had, without ficha.
// A patient with expedientes can't be deleted: the clinical history must be kept
export const deletePatient = async (req: Request<{ patientId: string }>, res: Response) => {
  const { patientId } = req.params;
  if (!UUID_PATTERN.test(patientId)) return notFound(res);

  const [clinicalCase] = await db
    .select({ id: patientCase.id })
    .from(patientCase)
    .where(and(eq(patientCase.patientId, patientId), eq(patientCase.organizationId, req.clinicId!)))
    .limit(1);
  if (clinicalCase) {
    return send(
      res,
      409,
      "HAS_CLINICAL_HISTORY",
      "Este paciente tiene expedientes clínicos y su ficha no se puede eliminar: la historia clínica debe conservarse.",
    );
  }

  const deleted = await db
    .delete(patient)
    .where(and(eq(patient.id, patientId), eq(patient.organizationId, req.clinicId!)))
    .returning({ id: patient.id });

  if (deleted.length === 0) return notFound(res);
  res.status(204).end();
};
