import type { Request, Response } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { caseNote, clinicalLog, member, patient, patientCase, user } from "../db/schema.js";
import { PROFESSIONAL_ROLES } from "../lib/appointments.js";
import {
  BODY_REGIONS,
  CLINICAL_MANAGER_ROLES,
  CLOSE_OUTCOMES,
  SIDES,
  isOneOf,
} from "../lib/clinical.js";
import { changedFrom, logClinical, logClinicalView } from "../lib/clinicalLog.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { isIsoDate } from "../lib/schedule.js";
import { utcToZoned } from "../lib/timezone.js";

// Historia clínica of a patient of the active clinic: antecedentes, expedientes
// (one per injury, open or closed) and their evolution notes.
// Health data: owners, admins and physios only (patient.routes.ts), and always
// filtered by req.clinicId.
// Every handler leaves a row in the clinical log (lib/clinicalLog.ts): who saw
// or changed what. Nothing with clinical content is lost: a change keeps the
// values it replaces in the log, and a deleted note is only marked as deleted.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patientNotFound = (res: Response) =>
  send(res, 404, "PATIENT_NOT_FOUND", "Este paciente no existe en tu clínica");
const caseNotFound = (res: Response) =>
  send(res, 404, "CASE_NOT_FOUND", "Este expediente no existe");
const noteNotFound = (res: Response) => send(res, 404, "NOTE_NOT_FOUND", "Esta nota no existe");

const isManager = (req: Request) => CLINICAL_MANAGER_ROLES.includes(req.clinicRole!);

// Today in the clinic's time zone, "2026-11-16"
const clinicToday = async (clinicId: string) =>
  utcToZoned(new Date(), await loadTimezone(clinicId)).date;

// ---------- Parsing ----------

// Reads optional text fields from a body: trimmed, "" saved as null.
// Returns the problem found, or null after filling `into`
function readTexts<K extends string>(
  body: Record<string, unknown>,
  limits: Record<K, number>,
  into: Partial<Record<K, string | null>>,
): string | null {
  for (const [key, max] of Object.entries(limits) as [K, number][]) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") return `El campo ${key} no es válido`;
    const text = value?.trim() ?? "";
    if (text.length > max) return `El campo ${key} admite como máximo ${max} caracteres`;
    into[key] = text || null;
  }
  return null;
}

// An optional date, not in the future. undefined = not sent; "invalid" = wrong
function readDate(value: unknown, today: string): string | null | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return isIsoDate(value) && value <= today ? value : "invalid";
}

// ---------- Lookups (each sends its own 404) ----------

async function findPatient(req: Request<{ patientId: string }>, res: Response) {
  const { patientId } = req.params;
  if (UUID_PATTERN.test(patientId)) {
    const [found] = await db
      .select({ id: patient.id })
      .from(patient)
      .where(and(eq(patient.id, patientId), eq(patient.organizationId, req.clinicId!)))
      .limit(1);
    if (found) return found;
  }
  patientNotFound(res);
  return null;
}

// The expediente, if it's this patient's and this clinic's
async function findCase(req: Request<{ patientId: string; caseId: string }>, res: Response) {
  const { patientId, caseId } = req.params;
  if (UUID_PATTERN.test(patientId) && UUID_PATTERN.test(caseId)) {
    const [found] = await db
      .select()
      .from(patientCase)
      .where(
        and(
          eq(patientCase.id, caseId),
          eq(patientCase.patientId, patientId),
          eq(patientCase.organizationId, req.clinicId!),
        ),
      )
      .limit(1);
    if (found) return found;
  }
  caseNotFound(res);
  return null;
}

// Who can attend patients in the clinic: the choices for "fisio responsable"
const loadProfessionals = (clinicId: string) =>
  db
    .select({ userId: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.organizationId, clinicId), inArray(member.role, PROFESSIONAL_ROLES)))
    .orderBy(asc(user.name));

// ---------- Read ----------

const BACKGROUND_LIMITS = {
  clinicalAlert: 300,
  allergies: 1000,
  medication: 1000,
  medicalHistory: 4000,
  occupation: 300,
} as const;

// GET /clinic/patients/:patientId/clinical -> { clinical }
// clinical: { background, cases: [{ ...case, notes }], professionals }
// Cases: open first, then newest. Notes: newest first
export const getClinical = async (req: Request<{ patientId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  if (!(await findPatient(req, res))) return;
  const { patientId } = req.params;

  const [[background], cases, notes, professionals] = await Promise.all([
    db
      .select({
        clinicalAlert: patient.clinicalAlert,
        allergies: patient.allergies,
        medication: patient.medication,
        medicalHistory: patient.medicalHistory,
        occupation: patient.occupation,
      })
      .from(patient)
      .where(eq(patient.id, patientId)),
    db
      .select({
        id: patientCase.id,
        title: patientCase.title,
        bodyRegion: patientCase.bodyRegion,
        side: patientCase.side,
        status: patientCase.status,
        physioId: patientCase.physioId,
        physioName: user.name,
        reason: patientCase.reason,
        diagnosis: patientCase.diagnosis,
        plan: patientCase.plan,
        onsetDate: patientCase.onsetDate,
        openedAt: patientCase.openedAt,
        closedAt: patientCase.closedAt,
        closeOutcome: patientCase.closeOutcome,
        closeNotes: patientCase.closeNotes,
      })
      .from(patientCase)
      .leftJoin(user, eq(patientCase.physioId, user.id))
      .where(and(eq(patientCase.patientId, patientId), eq(patientCase.organizationId, clinicId)))
      .orderBy(asc(patientCase.status), desc(patientCase.openedAt), desc(patientCase.createdAt)),
    db
      .select({
        id: caseNote.id,
        caseId: caseNote.caseId,
        date: caseNote.date,
        painLevel: caseNote.painLevel,
        text: caseNote.text,
        authorId: caseNote.authorId,
        authorName: user.name,
        createdAt: caseNote.createdAt,
        edited: sql<boolean>`${caseNote.updatedAt} > ${caseNote.createdAt}`,
      })
      .from(caseNote)
      .innerJoin(patientCase, eq(caseNote.caseId, patientCase.id))
      .leftJoin(user, eq(caseNote.authorId, user.id))
      .where(
        and(
          eq(patientCase.patientId, patientId),
          eq(caseNote.organizationId, clinicId),
          isNull(caseNote.deletedAt),
        ),
      )
      .orderBy(desc(caseNote.date), desc(caseNote.createdAt)),
    loadProfessionals(clinicId),
  ]);

  await logClinicalView(req, patientId);

  res.json({
    clinical: {
      background,
      cases: cases.map(({ physioId, physioName, ...c }) => ({
        ...c,
        physio: physioId ? { userId: physioId, name: physioName ?? "" } : null,
        notes: notes
          .filter((n) => n.caseId === c.id)
          .map(({ caseId: _caseId, authorId, authorName, ...n }) => ({
            ...n,
            author: authorId ? { userId: authorId, name: authorName ?? "" } : null,
          })),
      })),
      professionals,
    },
  });
};

// ---------- Antecedentes ----------

// PATCH /clinic/patients/:patientId/clinical -> 204
// body: any of { clinicalAlert, allergies, medication, medicalHistory, occupation }
export const updateBackground = async (req: Request<{ patientId: string }>, res: Response) => {
  const found = await findPatient(req, res);
  if (!found) return;

  const fields: Partial<Record<keyof typeof BACKGROUND_LIMITS, string | null>> = {};
  const problem = readTexts(req.body ?? {}, BACKGROUND_LIMITS, fields);
  if (problem) return send(res, 400, "INVALID_BACKGROUND", problem);
  if (Object.keys(fields).length === 0) {
    return send(res, 400, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }

  const [current] = await db
    .select({
      clinicalAlert: patient.clinicalAlert,
      allergies: patient.allergies,
      medication: patient.medication,
      medicalHistory: patient.medicalHistory,
      occupation: patient.occupation,
    })
    .from(patient)
    .where(eq(patient.id, found.id));
  const { changed, previous } = changedFrom(current!, fields);

  // Saved as it was: nothing to write or to log
  if (Object.keys(changed).length > 0) {
    await db.transaction(async (tx) => {
      await tx.update(patient).set(changed).where(eq(patient.id, found.id));
      await logClinical(
        req,
        {
          patientId: found.id,
          action: "update",
          entity: "background",
          fields: Object.keys(changed),
          previous,
        },
        tx,
      );
    });
  }
  res.status(204).end();
};

// ---------- Expedientes ----------

const CASE_TEXT_LIMITS = { reason: 2000, diagnosis: 2000, plan: 4000 } as const;
const CLOSE_NOTES_MAX = 2000;

type CaseFields = Partial<typeof patientCase.$inferInsert>;

// The descriptive fields that were sent (not the status). A string is the problem
async function parseCaseFields(
  clinicId: string,
  body: Record<string, unknown>,
  today: string,
): Promise<CaseFields | string> {
  const fields: CaseFields = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 150) {
      return "El expediente necesita un título (máximo 150 caracteres)";
    }
    fields.title = body.title.trim();
  }
  if (body.bodyRegion !== undefined) {
    if (!isOneOf(BODY_REGIONS, body.bodyRegion)) return "La zona del cuerpo no es válida";
    fields.bodyRegion = body.bodyRegion;
  }
  if (body.side !== undefined) {
    if (body.side !== null && !isOneOf(SIDES, body.side)) return "El lado no es válido";
    fields.side = body.side;
  }
  if (body.physioId !== undefined) {
    if (body.physioId !== null) {
      const professionals = await loadProfessionals(clinicId);
      if (!professionals.some((p) => p.userId === body.physioId)) {
        return "Ese profesional no atiende pacientes en tu clínica";
      }
    }
    fields.physioId = body.physioId as string | null;
  }

  const texts: Partial<Record<keyof typeof CASE_TEXT_LIMITS, string | null>> = {};
  const problem = readTexts(body, CASE_TEXT_LIMITS, texts);
  if (problem) return problem;
  Object.assign(fields, texts);

  const onsetDate = readDate(body.onsetDate, today);
  if (onsetDate === "invalid") return "La fecha de inicio de la lesión no es válida";
  if (onsetDate !== undefined) fields.onsetDate = onsetDate;

  const openedAt = readDate(body.openedAt, today);
  if (openedAt === "invalid" || openedAt === null) return "La fecha de apertura no es válida";
  if (openedAt !== undefined) fields.openedAt = openedAt;

  return fields;
}

// POST /clinic/patients/:patientId/cases -> 201 { caseId }
// body: { title, bodyRegion, side?, physioId?, reason?, diagnosis?, plan?, onsetDate?, openedAt? }
// Opens the expediente. Without physioId, the responsible physio is whoever
// creates it; without openedAt, today
export const createCase = async (req: Request<{ patientId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const found = await findPatient(req, res);
  if (!found) return;

  const body = req.body ?? {};
  const today = await clinicToday(clinicId);
  const fields = await parseCaseFields(clinicId, body, today);
  if (typeof fields === "string") return send(res, 400, "INVALID_CASE", fields);
  if (!fields.title || !fields.bodyRegion) {
    return send(res, 400, "INVALID_CASE", "El expediente necesita título y zona del cuerpo");
  }

  const values = {
    ...fields,
    title: fields.title,
    bodyRegion: fields.bodyRegion,
    physioId: fields.physioId === undefined ? req.user!.id : fields.physioId,
    openedAt: fields.openedAt ?? today,
    organizationId: clinicId,
    patientId: found.id,
    createdBy: req.user!.id,
  };
  const caseId = await db.transaction(async (tx) => {
    const [created] = await tx.insert(patientCase).values(values).returning({ id: patientCase.id });
    await logClinical(
      req,
      { patientId: found.id, action: "create", entity: "case", entityId: created!.id },
      tx,
    );
    return created!.id;
  });

  res.status(201).json({ caseId });
};

type CaseParams = { patientId: string; caseId: string };

// PATCH /clinic/patients/:patientId/cases/:caseId -> 204
// body: any field of the expediente, and/or:
//   { status: "closed", closeOutcome, closeNotes?, closedAt? }  close it
//   { status: "open" }                                          reopen it
export const updateCase = async (req: Request<CaseParams>, res: Response) => {
  const clinicId = req.clinicId!;
  const current = await findCase(req, res);
  if (!current) return;

  const body = req.body ?? {};
  const today = await clinicToday(clinicId);
  const fields = await parseCaseFields(clinicId, body, today);
  if (typeof fields === "string") return send(res, 400, "INVALID_CASE", fields);

  if (body.status !== undefined && body.status !== "open" && body.status !== "closed") {
    return send(res, 400, "INVALID_STATUS", "El estado debe ser open o closed");
  }
  const status: "open" | "closed" = body.status ?? current.status;
  const openedAt = fields.openedAt ?? current.openedAt;

  if (status === "open") {
    // Reopening forgets how it was closed
    Object.assign(fields, { status, closedAt: null, closeOutcome: null, closeNotes: null });
  } else {
    // Closing, or correcting how a closed one ended
    const closeOutcome = body.closeOutcome ?? current.closeOutcome;
    if (!isOneOf(CLOSE_OUTCOMES, closeOutcome)) {
      return send(res, 400, "OUTCOME_REQUIRED", "Indica cómo termina el expediente");
    }
    const closedAt = readDate(body.closedAt, today) ?? current.closedAt ?? today;
    if (closedAt === "invalid" || closedAt < openedAt) {
      return send(res, 400, "INVALID_CASE", "La fecha de cierre no puede ser anterior a la de apertura ni futura");
    }
    const notes: { closeNotes?: string | null } = {};
    const problem = readTexts(body, { closeNotes: CLOSE_NOTES_MAX }, notes);
    if (problem) return send(res, 400, "INVALID_CASE", problem);
    Object.assign(fields, { status, closeOutcome, closedAt, ...notes });
  }

  if (Object.keys(fields).length === 0) {
    return send(res, 400, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }

  const { changed, previous } = changedFrom(current, fields);
  if (Object.keys(changed).length > 0) {
    await db.transaction(async (tx) => {
      await tx.update(patientCase).set(changed).where(eq(patientCase.id, current.id));
      await logClinical(
        req,
        {
          patientId: current.patientId,
          action: "update",
          entity: "case",
          entityId: current.id,
          fields: Object.keys(changed),
          previous,
        },
        tx,
      );
    });
  }
  res.status(204).end();
};

// DELETE /clinic/patients/:patientId/cases/:caseId -> 204
// Only an expediente that never had notes (opened by mistake). With notes, even
// deleted ones, it's part of the clinical history: close it instead.
// What it said stays in the log
export const deleteCase = async (req: Request<CaseParams>, res: Response) => {
  const current = await findCase(req, res);
  if (!current) return;

  const [note] = await db
    .select({ id: caseNote.id })
    .from(caseNote)
    .where(eq(caseNote.caseId, current.id))
    .limit(1);
  if (note) {
    return send(
      res,
      409,
      "CASE_HAS_NOTES",
      "Este expediente tiene o ha tenido notas de evolución y no se puede eliminar. Puedes cerrarlo.",
    );
  }

  const { id, organizationId: _clinic, createdAt: _created, updatedAt: _updated, ...content } = current;
  await db.transaction(async (tx) => {
    await tx.delete(patientCase).where(eq(patientCase.id, id));
    await logClinical(
      req,
      {
        patientId: current.patientId,
        action: "delete",
        entity: "case",
        entityId: id,
        previous: content,
      },
      tx,
    );
  });
  res.status(204).end();
};

// ---------- Notas de evolución ----------

const NOTE_MAX = 5000;

// { date?, painLevel?, text? } as sent. A string is the problem found
function parseNote(body: Record<string, unknown>, today: string, openedAt: string) {
  const fields: { date?: string; painLevel?: number | null; text?: string } = {};

  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim() || body.text.trim().length > NOTE_MAX) {
      return `La nota necesita texto (máximo ${NOTE_MAX} caracteres)`;
    }
    fields.text = body.text.trim();
  }
  if (body.painLevel !== undefined) {
    const { painLevel } = body;
    if (painLevel !== null && !(Number.isInteger(painLevel) && (painLevel as number) >= 0 && (painLevel as number) <= 10)) {
      return "El dolor va de 0 a 10";
    }
    fields.painLevel = painLevel as number | null;
  }
  if (body.date !== undefined) {
    const date = readDate(body.date, today);
    if (date === "invalid" || date === null || date === undefined || date < openedAt) {
      return "La fecha de la nota no puede ser futura ni anterior a la apertura del expediente";
    }
    fields.date = date;
  }
  return fields;
}

// POST /clinic/patients/:patientId/cases/:caseId/notes -> 201 { noteId }
// body: { text, painLevel?, date? (default: today) }. Only in open expedientes
export const createNote = async (req: Request<CaseParams>, res: Response) => {
  const clinicId = req.clinicId!;
  const current = await findCase(req, res);
  if (!current) return;
  if (current.status === "closed") {
    return send(res, 409, "CASE_CLOSED", "El expediente está cerrado. Reábrelo para añadir notas.");
  }

  const today = await clinicToday(clinicId);
  const fields = parseNote(req.body ?? {}, today, current.openedAt);
  if (typeof fields === "string") return send(res, 400, "INVALID_NOTE", fields);
  if (!fields.text) return send(res, 400, "INVALID_NOTE", "La nota necesita texto");

  const values = {
    organizationId: clinicId,
    caseId: current.id,
    date: fields.date ?? today,
    painLevel: fields.painLevel ?? null,
    text: fields.text,
    authorId: req.user!.id,
  };
  const noteId = await db.transaction(async (tx) => {
    const [created] = await tx.insert(caseNote).values(values).returning({ id: caseNote.id });
    await logClinical(
      req,
      { patientId: current.patientId, action: "create", entity: "note", entityId: created!.id },
      tx,
    );
    return created!.id;
  });

  res.status(201).json({ noteId });
};

type NoteParams = CaseParams & { noteId: string };

// The note, if it's in this expediente (and not deleted) and the user may
// change it: its author, or an owner or admin
async function findOwnNote(req: Request<NoteParams>, res: Response) {
  const current = await findCase(req, res);
  if (!current) return null;
  const { noteId } = req.params;
  const [note] = UUID_PATTERN.test(noteId)
    ? await db
        .select()
        .from(caseNote)
        .where(
          and(eq(caseNote.id, noteId), eq(caseNote.caseId, current.id), isNull(caseNote.deletedAt)),
        )
        .limit(1)
    : [];
  if (!note) {
    noteNotFound(res);
    return null;
  }
  if (note.authorId !== req.user!.id && !isManager(req)) {
    send(res, 403, "NOT_YOUR_NOTE", "Solo puedes cambiar tus propias notas");
    return null;
  }
  return { note, openedAt: current.openedAt, patientId: current.patientId };
}

// PATCH .../notes/:noteId -> 204. body: any of { text, painLevel, date }
// The note is marked as edited, and what it said before is kept in the log
export const updateNote = async (req: Request<NoteParams>, res: Response) => {
  const found = await findOwnNote(req, res);
  if (!found) return;

  const today = await clinicToday(req.clinicId!);
  const fields = parseNote(req.body ?? {}, today, found.openedAt);
  if (typeof fields === "string") return send(res, 400, "INVALID_NOTE", fields);
  if (Object.keys(fields).length === 0) {
    return send(res, 400, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }

  const { changed, previous } = changedFrom(found.note, fields);
  if (Object.keys(changed).length > 0) {
    await db.transaction(async (tx) => {
      await tx
        .update(caseNote)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(caseNote.id, found.note.id));
      await logClinical(
        req,
        {
          patientId: found.patientId,
          action: "update",
          entity: "note",
          entityId: found.note.id,
          fields: Object.keys(changed),
          previous,
        },
        tx,
      );
    });
  }
  res.status(204).end();
};

// DELETE .../notes/:noteId -> 204
// The note stops showing in the expediente, but it isn't erased: the clinical
// history must be kept. It stays in the database, marked, and in the exports
export const deleteNote = async (req: Request<NoteParams>, res: Response) => {
  const found = await findOwnNote(req, res);
  if (!found) return;
  await db.transaction(async (tx) => {
    await tx
      .update(caseNote)
      .set({ deletedAt: new Date(), deletedBy: req.user!.id })
      .where(eq(caseNote.id, found.note.id));
    await logClinical(
      req,
      { patientId: found.patientId, action: "delete", entity: "note", entityId: found.note.id },
      tx,
    );
  });
  res.status(204).end();
};

// ---------- Registro ----------

const LOG_LIMIT = 200;

// GET /clinic/patients/:patientId/log -> { entries } (owners and admins)
// Who saw, changed or exported this patient's history, newest first. Changes
// come with the values they replaced
export const getClinicalLog = async (req: Request<{ patientId: string }>, res: Response) => {
  const found = await findPatient(req, res);
  if (!found) return;

  const entries = await db
    .select({
      id: clinicalLog.id,
      at: clinicalLog.createdAt,
      userName: clinicalLog.userName,
      action: clinicalLog.action,
      entity: clinicalLog.entity,
      entityId: clinicalLog.entityId,
      fields: clinicalLog.fields,
      previous: clinicalLog.previous,
    })
    .from(clinicalLog)
    .where(and(eq(clinicalLog.organizationId, req.clinicId!), eq(clinicalLog.patientId, found.id)))
    .orderBy(desc(clinicalLog.createdAt))
    .limit(LOG_LIMIT);

  res.json({ entries });
};
