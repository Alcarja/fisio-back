import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  exercise,
  exerciseProgram,
  exerciseProgramItem,
  organization,
  patient,
  patientCase,
  user,
} from "../db/schema.js";
import { changedFrom, logClinical } from "../lib/clinicalLog.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { doseLabel, LIMITS, optionalText, parseItems } from "../lib/exercises.js";
import { utcToZoned } from "../lib/timezone.js";
import { sendExerciseImage } from "./exercise.controller.js";

// Programas de ejercicios: what a patient is given to do at home, inside one
// of their expedientes. Clinical roles (patient.routes.ts), and the patient's
// own page (public, by the program's accessToken).
// The exercises are copied from the bank: later changes there don't change
// what the patient was given. Every change is in the clinical log.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const itemColumns = {
  id: exerciseProgramItem.id,
  programId: exerciseProgramItem.programId,
  exerciseId: exerciseProgramItem.exerciseId,
  name: exerciseProgramItem.name,
  instructions: exerciseProgramItem.instructions,
  precautions: exerciseProgramItem.precautions,
  notes: exerciseProgramItem.notes,
  sets: exerciseProgramItem.sets,
  reps: exerciseProgramItem.reps,
  seconds: exerciseProgramItem.seconds,
  restSeconds: exerciseProgramItem.restSeconds,
  perSide: exerciseProgramItem.perSide,
  position: exerciseProgramItem.position,
};

async function loadItems(programIds: string[]) {
  if (programIds.length === 0) return [];
  const rows = await db
    .select({ ...itemColumns, hasImage: exercise.imageData, imageVersion: exercise.updatedAt })
    .from(exerciseProgramItem)
    .leftJoin(exercise, eq(exerciseProgramItem.exerciseId, exercise.id))
    .where(inArray(exerciseProgramItem.programId, programIds))
    .orderBy(asc(exerciseProgramItem.position));
  return rows.map(({ hasImage, imageVersion, ...r }) => ({
    ...r,
    // Only whether there's one; the bytes go through the image routes
    hasImage: !!hasImage,
    imageVersion: hasImage ? imageVersion?.toISOString() ?? null : null,
  }));
}

const itemsSummary = (items: { name: string; sets: number | null; reps: number | null; seconds: number | null; restSeconds: number | null; perSide: boolean }[]) =>
  items.map((i) => `${i.name} ${doseLabel(i)}`.trim()).join(" · ");

// ---------- For the clinic ----------

type PatientParams = { patientId: string };

async function findPatient(req: Request<PatientParams>, res: Response) {
  const { patientId } = req.params;
  const [found] = UUID_PATTERN.test(patientId)
    ? await db
        .select({ id: patient.id })
        .from(patient)
        .where(and(eq(patient.id, patientId), eq(patient.organizationId, req.clinicId!)))
        .limit(1)
    : [];
  if (!found) send(res, 404, "PATIENT_NOT_FOUND", "Este paciente no existe en tu clínica");
  return found ?? null;
}

// GET /clinic/patients/:patientId/programs -> { programs } newest first, with items
export const listPrograms = async (req: Request<PatientParams>, res: Response) => {
  const found = await findPatient(req, res);
  if (!found) return;
  const programs = await db
    .select({
      id: exerciseProgram.id,
      caseId: exerciseProgram.caseId,
      status: exerciseProgram.status,
      frequency: exerciseProgram.frequency,
      notes: exerciseProgram.notes,
      startDate: exerciseProgram.startDate,
      finishedAt: exerciseProgram.finishedAt,
      accessToken: exerciseProgram.accessToken,
      createdByName: user.name,
      createdAt: exerciseProgram.createdAt,
    })
    .from(exerciseProgram)
    .leftJoin(user, eq(exerciseProgram.createdBy, user.id))
    .where(and(eq(exerciseProgram.organizationId, req.clinicId!), eq(exerciseProgram.patientId, found.id)))
    .orderBy(desc(exerciseProgram.createdAt));
  const items = await loadItems(programs.map((p) => p.id));
  res.json({
    programs: programs.map(({ accessToken, ...p }) => ({
      ...p,
      // The patient's page only works while it's active
      accessToken: p.status === "active" ? accessToken : null,
      items: items.filter((i) => i.programId === p.id).map(({ programId: _p, position: _o, ...i }) => i),
    })),
  });
};

// The program's fields and its exercises, copied from the bank. A string = what's wrong
async function parseProgram(clinicId: string, body: Record<string, unknown>) {
  const frequency = optionalText(body.frequency, LIMITS.frequency);
  if (frequency === undefined) return `La frecuencia admite ${LIMITS.frequency} caracteres`;
  const notes = optionalText(body.notes, LIMITS.notes);
  if (notes === undefined) return `Las indicaciones admiten ${LIMITS.notes} caracteres`;
  const items = parseItems(body.items);
  if (typeof items === "string") return items;

  const ids = [...new Set(items.map((i) => i.exerciseId))];
  if (!ids.every((id) => UUID_PATTERN.test(id))) return "Algún ejercicio no es válido";
  const sources = await db
    .select({
      id: exercise.id,
      name: exercise.name,
      instructions: exercise.instructions,
      precautions: exercise.precautions,
    })
    .from(exercise)
    .where(and(inArray(exercise.id, ids), or(eq(exercise.organizationId, clinicId), isNull(exercise.organizationId))));
  if (sources.length !== ids.length) return "Algún ejercicio no está en el banco";
  const byId = new Map(sources.map((s) => [s.id, s]));

  return {
    fields: { frequency, notes },
    items: items.map((item, position) => {
      const source = byId.get(item.exerciseId)!;
      return {
        ...item,
        position,
        name: source.name,
        instructions: source.instructions,
        precautions: source.precautions,
      };
    }),
  };
}

type CaseParams = PatientParams & { caseId: string };

// POST /clinic/patients/:patientId/cases/:caseId/programs -> 201 { programId }
// body: { frequency?, notes?, items: [...], replaces?: programId }
// One active program per expediente. `replaces` finishes the active one in the
// same step (a new phase); without it, an active one already there is a 409
export const createProgram = async (req: Request<CaseParams>, res: Response) => {
  const clinicId = req.clinicId!;
  const { patientId, caseId } = req.params;
  const [found] =
    UUID_PATTERN.test(patientId) && UUID_PATTERN.test(caseId)
      ? await db
          .select({ id: patientCase.id, status: patientCase.status })
          .from(patientCase)
          .where(
            and(
              eq(patientCase.id, caseId),
              eq(patientCase.patientId, patientId),
              eq(patientCase.organizationId, clinicId),
            ),
          )
          .limit(1)
      : [];
  if (!found) return send(res, 404, "CASE_NOT_FOUND", "Este expediente no existe");
  if (found.status === "closed") {
    return send(res, 409, "CASE_CLOSED", "El expediente está cerrado. Reábrelo para pautar ejercicios.");
  }

  const parsed = await parseProgram(clinicId, req.body ?? {});
  if (typeof parsed === "string") return send(res, 400, "INVALID_PROGRAM", parsed);

  const [active] = await db
    .select({ id: exerciseProgram.id })
    .from(exerciseProgram)
    .where(and(eq(exerciseProgram.caseId, caseId), eq(exerciseProgram.status, "active")))
    .limit(1);
  const replaces = req.body?.replaces;
  if (active && replaces !== active.id) {
    return send(res, 409, "PROGRAM_ACTIVE", "Este expediente ya tiene ejercicios activos. Finalízalos o crea una nueva fase.");
  }

  const today = utcToZoned(new Date(), await loadTimezone(clinicId)).date;
  const programId = await db.transaction(async (tx) => {
    if (active) {
      await tx
        .update(exerciseProgram)
        .set({ status: "finished", finishedAt: new Date() })
        .where(eq(exerciseProgram.id, active.id));
      await logClinical(req, { patientId, action: "update", entity: "program", entityId: active.id, fields: ["status"], previous: { status: "active" } }, tx);
    }
    const [created] = await tx
      .insert(exerciseProgram)
      .values({
        ...parsed.fields,
        organizationId: clinicId,
        patientId,
        caseId,
        startDate: today,
        accessToken: randomBytes(24).toString("base64url"),
        createdBy: req.user!.id,
      })
      .returning({ id: exerciseProgram.id });
    await tx.insert(exerciseProgramItem).values(parsed.items.map((i) => ({ ...i, programId: created!.id })));
    await logClinical(req, { patientId, action: "create", entity: "program", entityId: created!.id }, tx);
    return created!.id;
  });
  res.status(201).json({ programId });
};

type ProgramParams = PatientParams & { programId: string };

async function findProgram(req: Request<ProgramParams>, res: Response) {
  const { patientId, programId } = req.params;
  const [found] =
    UUID_PATTERN.test(patientId) && UUID_PATTERN.test(programId)
      ? await db
          .select()
          .from(exerciseProgram)
          .where(
            and(
              eq(exerciseProgram.id, programId),
              eq(exerciseProgram.patientId, patientId),
              eq(exerciseProgram.organizationId, req.clinicId!),
            ),
          )
          .limit(1)
      : [];
  if (!found) {
    send(res, 404, "PROGRAM_NOT_FOUND", "Estos ejercicios no existen");
    return null;
  }
  if (found.status !== "active") {
    send(res, 409, "PROGRAM_FINISHED", "Estos ejercicios ya están finalizados");
    return null;
  }
  return found;
}

// PUT /clinic/patients/:patientId/programs/:programId -> 204
// The whole program again (active ones only). What it said before stays in the log
export const updateProgram = async (req: Request<ProgramParams>, res: Response) => {
  const found = await findProgram(req, res);
  if (!found) return;
  const parsed = await parseProgram(req.clinicId!, req.body ?? {});
  if (typeof parsed === "string") return send(res, 400, "INVALID_PROGRAM", parsed);

  const currentItems = await db
    .select(itemColumns)
    .from(exerciseProgramItem)
    .where(eq(exerciseProgramItem.programId, found.id))
    .orderBy(asc(exerciseProgramItem.position));
  const before = { frequency: found.frequency, notes: found.notes, items: itemsSummary(currentItems) };
  const after = { ...parsed.fields, items: itemsSummary(parsed.items) };
  const itemNotesChanged =
    JSON.stringify(currentItems.map((i) => i.notes)) !== JSON.stringify(parsed.items.map((i) => i.notes));
  const { changed, previous } = changedFrom(before, after);
  if (itemNotesChanged && !("items" in changed)) {
    changed.items = after.items;
    previous.items = before.items;
  }

  await db.transaction(async (tx) => {
    await tx.update(exerciseProgram).set(parsed.fields).where(eq(exerciseProgram.id, found.id));
    await tx.delete(exerciseProgramItem).where(eq(exerciseProgramItem.programId, found.id));
    await tx.insert(exerciseProgramItem).values(parsed.items.map((i) => ({ ...i, programId: found.id })));
    if (Object.keys(changed).length > 0) {
      await logClinical(
        req,
        { patientId: found.patientId, action: "update", entity: "program", entityId: found.id, fields: Object.keys(changed), previous },
        tx,
      );
    }
  });
  res.status(204).end();
};

// POST /clinic/patients/:patientId/programs/:programId/finish -> 204
// The patient's link stops working. The program stays in the expediente
export const finishProgram = async (req: Request<ProgramParams>, res: Response) => {
  const found = await findProgram(req, res);
  if (!found) return;
  await db.transaction(async (tx) => {
    await tx
      .update(exerciseProgram)
      .set({ status: "finished", finishedAt: new Date() })
      .where(eq(exerciseProgram.id, found.id));
    await logClinical(
      req,
      { patientId: found.patientId, action: "update", entity: "program", entityId: found.id, fields: ["status"], previous: { status: "active" } },
      tx,
    );
  });
  res.status(204).end();
};

// GET /clinic/patients/:patientId/programs/:programId/items/:itemId/image
export const getProgramItemImage = async (req: Request<ProgramParams & { itemId: string }>, res: Response) => {
  const { patientId, programId, itemId } = req.params;
  const [found] =
    [patientId, programId, itemId].every((id) => UUID_PATTERN.test(id))
      ? await db
          .select({ exerciseId: exerciseProgramItem.exerciseId })
          .from(exerciseProgramItem)
          .innerJoin(exerciseProgram, eq(exerciseProgramItem.programId, exerciseProgram.id))
          .where(
            and(
              eq(exerciseProgramItem.id, itemId),
              eq(exerciseProgram.id, programId),
              eq(exerciseProgram.patientId, patientId),
              eq(exerciseProgram.organizationId, req.clinicId!),
            ),
          )
          .limit(1)
      : [];
  return sendExerciseImage(res, found?.exerciseId ?? null, req.clinicId!);
};

// GET /clinic/exercise-programs -> { programs }
// The clinic's active programs, newest first: who has exercises for home
// right now, to follow up. Only what the list needs (no exercises' text)
export const listActivePrograms = async (req: Request, res: Response) => {
  const rows = await db
    .select({
      id: exerciseProgram.id,
      patientId: exerciseProgram.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      caseId: exerciseProgram.caseId,
      caseTitle: patientCase.title,
      startDate: exerciseProgram.startDate,
      frequency: exerciseProgram.frequency,
      createdByName: user.name,
    })
    .from(exerciseProgram)
    .innerJoin(patient, eq(exerciseProgram.patientId, patient.id))
    .innerJoin(patientCase, eq(exerciseProgram.caseId, patientCase.id))
    .leftJoin(user, eq(exerciseProgram.createdBy, user.id))
    .where(and(eq(exerciseProgram.organizationId, req.clinicId!), eq(exerciseProgram.status, "active")))
    .orderBy(desc(exerciseProgram.startDate), desc(exerciseProgram.createdAt));
  const counts = rows.length
    ? await db
        .select({ programId: exerciseProgramItem.programId, name: exerciseProgramItem.name })
        .from(exerciseProgramItem)
        .where(inArray(exerciseProgramItem.programId, rows.map((r) => r.id)))
        .orderBy(asc(exerciseProgramItem.position))
    : [];
  res.json({
    programs: rows.map((r) => {
      const names = counts.filter((c) => c.programId === r.id).map((c) => c.name);
      return { ...r, itemCount: names.length, itemNames: names.slice(0, 4) };
    }),
  });
};

// ---------- The patient's page (public) ----------

// An active program by its key, with its clinic. null if there's none
async function findByToken(token: string) {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const [found] = await db
    .select({
      id: exerciseProgram.id,
      clinicId: exerciseProgram.organizationId,
      clinicName: organization.name,
      clinicStatus: organization.status,
      frequency: exerciseProgram.frequency,
      notes: exerciseProgram.notes,
      startDate: exerciseProgram.startDate,
      physioName: user.name,
    })
    .from(exerciseProgram)
    .innerJoin(organization, eq(exerciseProgram.organizationId, organization.id))
    .leftJoin(user, eq(exerciseProgram.createdBy, user.id))
    .where(and(eq(exerciseProgram.accessToken, token), eq(exerciseProgram.status, "active")))
    .limit(1);
  if (!found || found.clinicStatus === "inactive") return null;
  return found;
}

const notFound = (res: Response) =>
  send(res, 404, "PROGRAM_NOT_FOUND", "Este enlace ya no está activo. Pide a tu fisio uno nuevo.");

// GET /public/exercises/:token -> { program }
// Only the exercises: never the patient's name, the diagnosis or the expediente
export const getPublicProgram = async (req: Request<{ token: string }>, res: Response) => {
  const found = await findByToken(req.params.token);
  // Search engines must never keep this page
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "private, no-store");
  if (!found) return notFound(res);
  const items = await loadItems([found.id]);
  res.json({
    program: {
      clinicName: found.clinicName,
      physioName: found.physioName,
      frequency: found.frequency,
      notes: found.notes,
      startDate: found.startDate,
      items: items.map(({ programId: _p, position: _o, exerciseId: _e, ...i }) => i),
    },
  });
};

// GET /public/exercises/:token/items/:itemId/image -> the image
export const getPublicProgramImage = async (req: Request<{ token: string; itemId: string }>, res: Response) => {
  const found = await findByToken(req.params.token);
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!found || !UUID_PATTERN.test(req.params.itemId)) return notFound(res);
  const [item] = await db
    .select({ exerciseId: exerciseProgramItem.exerciseId })
    .from(exerciseProgramItem)
    .where(and(eq(exerciseProgramItem.id, req.params.itemId), eq(exerciseProgramItem.programId, found.id)))
    .limit(1);
  return sendExerciseImage(res, item?.exerciseId ?? null, found.clinicId);
};
