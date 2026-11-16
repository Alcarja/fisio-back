import type { Request, Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  caseNote,
  organization,
  patient,
  patientCase,
  service,
  user,
} from "../db/schema.js";
import { logClinical } from "../lib/clinicalLog.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { utcToZoned } from "../lib/timezone.js";

// Exports, as JSON: everything the clinic holds about one patient (to answer a
// patient who asks for their data or a copy of their clinical history), or
// about all of them (to keep its own copy, or to leave Kineflow).
// They include the health data, and the notes deleted from an expediente
// (marked with deletedAt). Each export is written in the clinical log.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The fichas of a clinic (or just one), each with its expedientes and notes
async function loadPatients(clinicId: string, patientId?: string) {
  const author = alias(user, "author");
  const onlyThis = patientId ? [eq(patient.id, patientId)] : [];

  const patients = await db
    .select()
    .from(patient)
    .where(and(eq(patient.organizationId, clinicId), ...onlyThis))
    .orderBy(asc(patient.lastName), asc(patient.firstName));
  if (patients.length === 0) return [];
  const ids = patients.map((p) => p.id);

  const [cases, notes] = await Promise.all([
    db
      .select({ case: patientCase, physioName: user.name })
      .from(patientCase)
      .leftJoin(user, eq(patientCase.physioId, user.id))
      .where(and(eq(patientCase.organizationId, clinicId), inArray(patientCase.patientId, ids)))
      .orderBy(asc(patientCase.openedAt), asc(patientCase.createdAt)),
    db
      .select({
        id: caseNote.id,
        caseId: caseNote.caseId,
        date: caseNote.date,
        painLevel: caseNote.painLevel,
        text: caseNote.text,
        authorName: author.name,
        createdAt: caseNote.createdAt,
        updatedAt: caseNote.updatedAt,
        deletedAt: caseNote.deletedAt,
      })
      .from(caseNote)
      .innerJoin(patientCase, eq(caseNote.caseId, patientCase.id))
      .leftJoin(author, eq(caseNote.authorId, author.id))
      .where(and(eq(caseNote.organizationId, clinicId), inArray(patientCase.patientId, ids)))
      .orderBy(asc(caseNote.date), asc(caseNote.createdAt)),
  ]);

  return patients.map(({ organizationId: _clinic, createdBy: _by, ...p }) => ({
    ...p,
    cases: cases
      .filter((c) => c.case.patientId === p.id)
      .map(({ case: { organizationId: _c, patientId: _p, physioId: _f, createdBy: _b, ...c }, physioName }) => ({
        ...c,
        physioName,
        notes: notes.filter((n) => n.caseId === c.id).map(({ caseId: _caseId, ...n }) => n),
      })),
  }));
}

// One row per patient and appointment (group sessions have several), oldest
// first, in the clinic's local time. With patientId: only that ficha's
async function loadAppointments(clinicId: string, patientId?: string) {
  const [timeZone, rows] = await Promise.all([
    loadTimezone(clinicId),
    db
      .select({
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes,
        contactPhone: appointment.contactPhone,
        contactEmail: appointment.contactEmail,
        serviceName: service.name,
        physioName: user.name,
        patientId: appointmentPatient.patientId,
        firstName: appointmentPatient.firstName,
        lastName: appointmentPatient.lastName,
        attendance: appointmentPatient.attendance,
      })
      .from(appointmentPatient)
      .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
      .innerJoin(service, eq(appointment.serviceId, service.id))
      .innerJoin(user, eq(appointment.physioId, user.id))
      .where(
        and(
          eq(appointmentPatient.organizationId, clinicId),
          ...(patientId ? [eq(appointmentPatient.patientId, patientId)] : []),
        ),
      )
      .orderBy(asc(appointment.startsAt)),
  ]);

  return rows.map(({ startsAt, endsAt, ...row }) => {
    const start = utcToZoned(startsAt, timeZone);
    return { ...row, date: start.date, startTime: start.time, endTime: utcToZoned(endsAt, timeZone).time };
  });
}

const loadClinic = async (clinicId: string) => {
  const [clinic] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, clinicId))
    .limit(1);
  return clinic!;
};

// GET /clinic/patients/:patientId/export -> { exportedAt, clinic, patient }
// patient: the ficha with its antecedentes, cases (with notes) and appointments.
// Clinical roles: it carries the whole clinical history
export const exportPatient = async (req: Request<{ patientId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { patientId } = req.params;
  const [found] = UUID_PATTERN.test(patientId) ? await loadPatients(clinicId, patientId) : [];
  if (!found) {
    res.status(404).json({
      error: { code: "PATIENT_NOT_FOUND", message: "Este paciente no existe en tu clínica" },
    });
    return;
  }

  const [clinic, appointments] = await Promise.all([
    loadClinic(clinicId),
    loadAppointments(clinicId, patientId),
  ]);
  await logClinical(req, { patientId, action: "export", entity: "record" });

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    exportedAt: new Date(),
    clinic,
    patient: {
      ...found,
      appointments: appointments.map(({ patientId: _p, firstName: _f, lastName: _l, ...a }) => a),
    },
  });
};

// GET /clinic/patients/export -> { exportedAt, clinic, patients, appointments }
// Every ficha with its clinical history, and every appointment (also the ones
// given with just a name, without ficha). Owners and admins
export const exportClinic = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const [clinic, patients, appointments] = await Promise.all([
    loadClinic(clinicId),
    loadPatients(clinicId),
    loadAppointments(clinicId),
  ]);
  await logClinical(req, { patientId: null, action: "export", entity: "clinic" });

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ exportedAt: new Date(), clinic, patients, appointments });
};
