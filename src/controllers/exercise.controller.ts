import type { Request, Response } from "express";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { exercise, exerciseTemplate, exerciseTemplateItem } from "../db/schema.js";
import { LIMITS, optionalText, parseExercise, parseItems } from "../lib/exercises.js";
import { readUploadedImage } from "../lib/images.js";

// Ejercicios: the clinic's bank (plus Kineflow's base bank, read only) and its
// tablas. Owners, admins and physios of the active clinic (exercise.routes.ts).
// Patients' programs are in program.controller.ts.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Exercises a clinic can see: its own and the base bank
const visibleTo = (clinicId: string) =>
  or(eq(exercise.organizationId, clinicId), isNull(exercise.organizationId));

const exerciseColumns = {
  id: exercise.id,
  name: exercise.name,
  bodyRegions: exercise.bodyRegions,
  type: exercise.type,
  equipment: exercise.equipment,
  instructions: exercise.instructions,
  precautions: exercise.precautions,
  defaultSets: exercise.defaultSets,
  defaultReps: exercise.defaultReps,
  defaultSeconds: exercise.defaultSeconds,
  defaultRestSeconds: exercise.defaultRestSeconds,
  perSide: exercise.perSide,
  // Kineflow's base bank: can't be edited, only duplicated
  isBase: sql<boolean>`${exercise.organizationId} is null`,
  hasImage: sql<boolean>`${exercise.imageData} is not null`,
  archived: exercise.archived,
  // Changes when the exercise (or its image) changes: for the image's cache
  updatedAt: exercise.updatedAt,
};

// ---------- Bank ----------

// GET /clinic/exercises -> { exercises } (own and base, not archived), by name
export const listExercises = async (req: Request, res: Response) => {
  const exercises = await db
    .select(exerciseColumns)
    .from(exercise)
    .where(and(visibleTo(req.clinicId!), eq(exercise.archived, false)))
    .orderBy(asc(exercise.name));
  res.json({ exercises });
};

// The clinic's own exercise (not base, not another clinic's), or a 404/403
async function findOwn(req: Request<{ exerciseId: string }>, res: Response) {
  const { exerciseId } = req.params;
  const [found] = UUID_PATTERN.test(exerciseId)
    ? await db
        .select({ id: exercise.id, organizationId: exercise.organizationId })
        .from(exercise)
        .where(and(eq(exercise.id, exerciseId), visibleTo(req.clinicId!)))
        .limit(1)
    : [];
  if (!found) {
    send(res, 404, "EXERCISE_NOT_FOUND", "Este ejercicio no existe");
    return null;
  }
  if (found.organizationId === null) {
    send(res, 403, "BASE_EXERCISE", "Los ejercicios de Kineflow no se editan: duplícalo para adaptarlo");
    return null;
  }
  return found;
}

// POST /clinic/exercises -> 201 { exercise }
export const createExercise = async (req: Request, res: Response) => {
  const fields = parseExercise(req.body ?? {});
  if (typeof fields === "string") return send(res, 400, "INVALID_EXERCISE", fields);
  const [created] = await db
    .insert(exercise)
    .values({ ...fields, organizationId: req.clinicId!, createdBy: req.user!.id })
    .returning(exerciseColumns);
  res.status(201).json({ exercise: created });
};

// PUT /clinic/exercises/:exerciseId -> { exercise }. The whole exercise
export const updateExercise = async (req: Request<{ exerciseId: string }>, res: Response) => {
  const found = await findOwn(req, res);
  if (!found) return;
  const fields = parseExercise(req.body ?? {});
  if (typeof fields === "string") return send(res, 400, "INVALID_EXERCISE", fields);
  const [updated] = await db
    .update(exercise)
    .set(fields)
    .where(eq(exercise.id, found.id))
    .returning(exerciseColumns);
  res.json({ exercise: updated });
};

// DELETE /clinic/exercises/:exerciseId -> 204
// Archived, not erased: programs already given keep showing its image. It
// disappears from the bank and from the tablas
export const archiveExercise = async (req: Request<{ exerciseId: string }>, res: Response) => {
  const found = await findOwn(req, res);
  if (!found) return;
  await db.transaction(async (tx) => {
    await tx.update(exercise).set({ archived: true }).where(eq(exercise.id, found.id));
    await tx.delete(exerciseTemplateItem).where(eq(exerciseTemplateItem.exerciseId, found.id));
  });
  res.status(204).end();
};

// POST /clinic/exercises/:exerciseId/duplicate -> 201 { exercise }
// A copy in the clinic's own bank, image included. The way to adapt a base one
export const duplicateExercise = async (req: Request<{ exerciseId: string }>, res: Response) => {
  const { exerciseId } = req.params;
  const [source] = UUID_PATTERN.test(exerciseId)
    ? await db
        .select()
        .from(exercise)
        .where(and(eq(exercise.id, exerciseId), visibleTo(req.clinicId!)))
        .limit(1)
    : [];
  if (!source) return send(res, 404, "EXERCISE_NOT_FOUND", "Este ejercicio no existe");

  const { id: _id, baseKey: _key, createdAt: _c, updatedAt: _u, organizationId, ...copy } = source;
  const [created] = await db
    .insert(exercise)
    .values({
      ...copy,
      // A copy of one of the clinic's own gets "(copia)"; a base one keeps its name
      name: organizationId ? `${copy.name} (copia)`.slice(0, LIMITS.name) : copy.name,
      archived: false,
      organizationId: req.clinicId!,
      createdBy: req.user!.id,
    })
    .returning(exerciseColumns);
  res.status(201).json({ exercise: created });
};

// PUT /clinic/exercises/:exerciseId/image -> 204. The body is the image
// (JPG, PNG or WebP, up to 2 MB), read by express.raw in exercise.routes.ts
export const uploadExerciseImage = async (req: Request<{ exerciseId: string }>, res: Response) => {
  const found = await findOwn(req, res);
  if (!found) return;
  const image = readUploadedImage(req);
  if (typeof image === "string") return send(res, 400, "INVALID_IMAGE", image);
  await db
    .update(exercise)
    .set({ imageType: image.type, imageData: image.data })
    .where(eq(exercise.id, found.id));
  res.status(204).end();
};

// DELETE /clinic/exercises/:exerciseId/image -> 204
export const deleteExerciseImage = async (req: Request<{ exerciseId: string }>, res: Response) => {
  const found = await findOwn(req, res);
  if (!found) return;
  await db.update(exercise).set({ imageType: null, imageData: null }).where(eq(exercise.id, found.id));
  res.status(204).end();
};

// Sends an exercise's image, or a 404
export async function sendExerciseImage(res: Response, exerciseId: string | null, clinicId: string) {
  const [found] =
    exerciseId && UUID_PATTERN.test(exerciseId)
      ? await db
          .select({ imageType: exercise.imageType, imageData: exercise.imageData })
          .from(exercise)
          .where(and(eq(exercise.id, exerciseId), visibleTo(clinicId)))
          .limit(1)
      : [];
  if (!found?.imageData || !found.imageType) {
    return send(res, 404, "IMAGE_NOT_FOUND", "Este ejercicio no tiene imagen");
  }
  res.setHeader("Content-Type", found.imageType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // The URL carries ?v=<updatedAt>, so a changed image is a new URL
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.end(found.imageData);
}

// GET /clinic/exercises/:exerciseId/image -> the image
export const getExerciseImage = (req: Request<{ exerciseId: string }>, res: Response) =>
  sendExerciseImage(res, req.params.exerciseId, req.clinicId!);

// ---------- Tablas ----------

const templateItemColumns = {
  id: exerciseTemplateItem.id,
  templateId: exerciseTemplateItem.templateId,
  exerciseId: exerciseTemplateItem.exerciseId,
  sets: exerciseTemplateItem.sets,
  reps: exerciseTemplateItem.reps,
  seconds: exerciseTemplateItem.seconds,
  restSeconds: exerciseTemplateItem.restSeconds,
  perSide: exerciseTemplateItem.perSide,
  notes: exerciseTemplateItem.notes,
  position: exerciseTemplateItem.position,
};

// GET /clinic/exercise-templates -> { templates: [{ ..., items }] }, by name
export const listTemplates = async (req: Request, res: Response) => {
  const templates = await db
    .select({
      id: exerciseTemplate.id,
      name: exerciseTemplate.name,
      frequency: exerciseTemplate.frequency,
      notes: exerciseTemplate.notes,
      updatedAt: exerciseTemplate.updatedAt,
    })
    .from(exerciseTemplate)
    .where(eq(exerciseTemplate.organizationId, req.clinicId!))
    .orderBy(asc(exerciseTemplate.name));
  const items = templates.length
    ? await db
        .select(templateItemColumns)
        .from(exerciseTemplateItem)
        .where(inArray(exerciseTemplateItem.templateId, templates.map((t) => t.id)))
        .orderBy(asc(exerciseTemplateItem.position))
    : [];
  res.json({
    templates: templates.map((t) => ({
      ...t,
      items: items
        .filter((i) => i.templateId === t.id)
        .map(({ templateId: _t, position: _p, ...i }) => i),
    })),
  });
};

type TemplateFields = { name: string; frequency: string | null; notes: string | null };

// The tabla sent, checked: its fields and its exercises (which must be ones
// the clinic can see and not archived). A string = what's wrong
async function parseTemplate(clinicId: string, body: Record<string, unknown>) {
  const name = optionalText(body.name, LIMITS.name);
  if (!name) return `La tabla necesita un nombre (máximo ${LIMITS.name} caracteres)`;
  const frequency = optionalText(body.frequency, LIMITS.frequency);
  if (frequency === undefined) return `La frecuencia admite ${LIMITS.frequency} caracteres`;
  const notes = optionalText(body.notes, LIMITS.notes);
  if (notes === undefined) return `Las notas admiten ${LIMITS.notes} caracteres`;
  const items = parseItems(body.items);
  if (typeof items === "string") return items;

  const ids = [...new Set(items.map((i) => i.exerciseId))];
  if (!ids.every((id) => UUID_PATTERN.test(id))) return "Algún ejercicio no es válido";
  const found = await db
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(inArray(exercise.id, ids), visibleTo(clinicId), eq(exercise.archived, false)));
  if (found.length !== ids.length) return "Algún ejercicio ya no está en el banco";
  return { fields: { name, frequency, notes } as TemplateFields, items };
}

// POST /clinic/exercise-templates -> 201 { templateId }
// body: { name, frequency?, notes?, items: [{ exerciseId, sets, reps, seconds, restSeconds, perSide, notes }] }
export const createTemplate = async (req: Request, res: Response) => {
  const parsed = await parseTemplate(req.clinicId!, req.body ?? {});
  if (typeof parsed === "string") return send(res, 400, "INVALID_TEMPLATE", parsed);
  const templateId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(exerciseTemplate)
      .values({ ...parsed.fields, organizationId: req.clinicId!, createdBy: req.user!.id })
      .returning({ id: exerciseTemplate.id });
    await tx
      .insert(exerciseTemplateItem)
      .values(parsed.items.map((item, position) => ({ ...item, position, templateId: created!.id })));
    return created!.id;
  });
  res.status(201).json({ templateId });
};

async function findTemplate(req: Request<{ templateId: string }>, res: Response) {
  const { templateId } = req.params;
  const [found] = UUID_PATTERN.test(templateId)
    ? await db
        .select({ id: exerciseTemplate.id })
        .from(exerciseTemplate)
        .where(and(eq(exerciseTemplate.id, templateId), eq(exerciseTemplate.organizationId, req.clinicId!)))
        .limit(1)
    : [];
  if (!found) send(res, 404, "TEMPLATE_NOT_FOUND", "Esta tabla no existe");
  return found ?? null;
}

// PUT /clinic/exercise-templates/:templateId -> 204. The whole tabla.
// Programs already given don't change: they're copies
export const updateTemplate = async (req: Request<{ templateId: string }>, res: Response) => {
  const found = await findTemplate(req, res);
  if (!found) return;
  const parsed = await parseTemplate(req.clinicId!, req.body ?? {});
  if (typeof parsed === "string") return send(res, 400, "INVALID_TEMPLATE", parsed);
  await db.transaction(async (tx) => {
    await tx.update(exerciseTemplate).set(parsed.fields).where(eq(exerciseTemplate.id, found.id));
    await tx.delete(exerciseTemplateItem).where(eq(exerciseTemplateItem.templateId, found.id));
    await tx
      .insert(exerciseTemplateItem)
      .values(parsed.items.map((item, position) => ({ ...item, position, templateId: found.id })));
  });
  res.status(204).end();
};

// DELETE /clinic/exercise-templates/:templateId -> 204
export const deleteTemplate = async (req: Request<{ templateId: string }>, res: Response) => {
  const found = await findTemplate(req, res);
  if (!found) return;
  await db.delete(exerciseTemplate).where(eq(exerciseTemplate.id, found.id));
  res.status(204).end();
};
