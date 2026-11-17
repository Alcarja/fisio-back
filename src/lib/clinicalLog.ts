import type { Request } from "express";
import { db } from "../db/index.js";
import { clinicalLog } from "../db/schema.js";

// The record of who saw, changed or exported each patient's clinical history
// (clinical_log in db/clinical-schema.ts). Every handler that touches health
// data writes one row here. Changes are written in the same transaction as the
// change itself, with the values they replace: that is the version history.

export type ClinicalLogEntry = {
  // null: the export of the whole clinic
  patientId: string | null;
  action: "view" | "create" | "update" | "delete" | "export";
  entity: "record" | "background" | "case" | "note" | "clinic" | "program";
  entityId?: string;
  // Changes: the fields that changed and the values they had
  fields?: string[];
  previous?: Record<string, unknown>;
};

// The database, or the transaction the change is made in
type Executor = Pick<typeof db, "insert">;

export async function logClinical(req: Request, entry: ClinicalLogEntry, executor: Executor = db) {
  await executor.insert(clinicalLog).values({
    organizationId: req.clinicId!,
    userId: req.user!.id,
    userName: req.user!.name,
    ip: req.ip ?? null,
    ...entry,
  });
}

// The ficha reloads the history after every change and every time its tab gets
// the focus again: one "view" row per person and patient every few minutes is
// enough to know who looked at it and when
const VIEW_EVERY_MS = 10 * 60 * 1000;
const lastViews = new Map<string, number>();

export async function logClinicalView(req: Request, patientId: string) {
  const key = `${req.clinicId}:${req.user!.id}:${patientId}`;
  const now = Date.now();
  if (now - (lastViews.get(key) ?? 0) < VIEW_EVERY_MS) return;

  await logClinical(req, { patientId, action: "view", entity: "record" });
  lastViews.set(key, now);

  // Forget the old ones so the list doesn't grow for ever
  if (lastViews.size > 5000) {
    for (const [k, at] of lastViews) if (now - at >= VIEW_EVERY_MS) lastViews.delete(k);
  }
}

// The fields of `changes` whose value is different from the one in `current`,
// and the values they had
export function changedFrom<T extends Record<string, unknown>>(
  current: T,
  changes: Partial<T>,
): { changed: Partial<T>; previous: Record<string, unknown> } {
  const changed: Partial<T> = {};
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(changes) as (keyof T & string)[]) {
    if (changes[key] === undefined || changes[key] === current[key]) continue;
    changed[key] = changes[key];
    previous[key] = current[key];
  }
  return { changed, previous };
}
