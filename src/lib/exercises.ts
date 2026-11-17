import { BODY_REGIONS, isOneOf } from "./clinical.js";

// Ejercicios para casa (db/exercise-schema.ts): the fixed lists and checks.
// Mirrored in front/src/adapters/api.ts; labels in
// front/src/pages/Admin/Exercises/exerciseFormat.ts

export const EXERCISE_TYPES = ["mobility", "strength", "stretching", "balance", "breathing"] as const;

export const EQUIPMENT = [
  "none",
  "mat",
  "band",
  "dumbbell",
  "fitball",
  "step",
  "chair",
  "wall",
  "towel",
  "foam_roller",
] as const;

// Who works with exercises: the clinical roles (receptionists don't)
export const EXERCISE_ROLES = ["owner", "admin", "physio"] as const;

// Images of the bank: small, already compressed by the browser
export const EXERCISE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_EXERCISE_IMAGE_BYTES = 2 * 1024 * 1024;

export const LIMITS = {
  name: 120,
  instructions: 3000,
  precautions: 1000,
  notes: 1000,
  frequency: 200,
  itemsPerList: 40,
};

const int = (value: unknown, min: number, max: number) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isInteger(value) && (value as number) >= min && (value as number) <= max
      ? (value as number)
      : undefined;

export type Dose = {
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  restSeconds: number | null;
  perSide: boolean;
};

// Sets, reps or seconds, rest and "each side". A string = what's wrong
export function parseDose(body: Record<string, unknown>, prefix = ""): Dose | string {
  const key = (k: string) => (prefix ? `${prefix}${k[0]!.toUpperCase()}${k.slice(1)}` : k);
  const sets = int(body[key("sets")], 1, 20);
  const reps = int(body[key("reps")], 1, 200);
  const seconds = int(body[key("seconds")], 1, 1800);
  const restSeconds = int(body[key("restSeconds")], 0, 600);
  if (sets === undefined) return "Las series van de 1 a 20";
  if (reps === undefined) return "Las repeticiones van de 1 a 200";
  if (seconds === undefined) return "El tiempo va de 1 a 1800 segundos";
  if (restSeconds === undefined) return "El descanso va de 0 a 600 segundos";
  const perSide = body[key("perSide")];
  if (perSide !== undefined && typeof perSide !== "boolean") return "«Cada lado» no es válido";
  return { sets, reps, seconds, restSeconds, perSide: perSide === true };
}

// Optional text: trimmed, "" = null. undefined = too long or not text
export function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text.length > max) return undefined;
  return text || null;
}

export type ExerciseFields = {
  name: string;
  bodyRegions: string[];
  type: string;
  equipment: string[];
  instructions: string;
  precautions: string | null;
  defaultSets: number | null;
  defaultReps: number | null;
  defaultSeconds: number | null;
  defaultRestSeconds: number | null;
  perSide: boolean;
};

// A whole exercise of the bank, checked. A string = what's wrong
export function parseExercise(body: Record<string, unknown>): ExerciseFields | string {
  const name = optionalText(body.name, LIMITS.name);
  if (!name) return `El ejercicio necesita un nombre (máximo ${LIMITS.name} caracteres)`;
  const regions = body.bodyRegions;
  if (!Array.isArray(regions) || regions.length === 0 || !regions.every((r) => isOneOf(BODY_REGIONS, r))) {
    return "Elige al menos una zona del cuerpo";
  }
  if (!isOneOf(EXERCISE_TYPES, body.type)) return "Elige el tipo de ejercicio";
  const equipment = body.equipment;
  if (!Array.isArray(equipment) || !equipment.every((e) => isOneOf(EQUIPMENT, e))) {
    return "El material no es válido";
  }
  const instructions = optionalText(body.instructions, LIMITS.instructions);
  if (!instructions) return `Escribe cómo se hace (máximo ${LIMITS.instructions} caracteres)`;
  const precautions = optionalText(body.precautions, LIMITS.precautions);
  if (precautions === undefined) return `Las precauciones admiten ${LIMITS.precautions} caracteres`;
  const dose = parseDose(body, "default");
  if (typeof dose === "string") return dose;

  return {
    name,
    bodyRegions: [...new Set(regions as string[])],
    type: body.type,
    equipment: equipment.length ? [...new Set(equipment as string[])] : ["none"],
    instructions,
    precautions,
    defaultSets: dose.sets,
    defaultReps: dose.reps,
    defaultSeconds: dose.seconds,
    defaultRestSeconds: dose.restSeconds,
    perSide: dose.perSide,
  };
}

export type ListItem = Dose & { exerciseId: string; notes: string | null };

// The exercises of a tabla or a program: [{ exerciseId, sets, reps…, notes }]
export function parseItems(value: unknown): ListItem[] | string {
  if (!Array.isArray(value) || value.length === 0) return "Añade al menos un ejercicio";
  if (value.length > LIMITS.itemsPerList) return `Como máximo ${LIMITS.itemsPerList} ejercicios`;
  const items: ListItem[] = [];
  for (const raw of value) {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (typeof item.exerciseId !== "string") return "Algún ejercicio no es válido";
    const dose = parseDose(item);
    if (typeof dose === "string") return dose;
    const notes = optionalText(item.notes, LIMITS.notes);
    if (notes === undefined) return `Las indicaciones admiten ${LIMITS.notes} caracteres`;
    items.push({ exerciseId: item.exerciseId, notes, ...dose });
  }
  return items;
}

// "3 × 12", "3 × 30 s", "cada lado"… for the clinical log
export function doseLabel(d: Dose) {
  const amount = d.reps ? `${d.reps}` : d.seconds ? `${d.seconds} s` : "";
  const main = d.sets && amount ? `${d.sets} × ${amount}` : amount || (d.sets ? `${d.sets} series` : "");
  return [main, d.perSide ? "cada lado" : ""].filter(Boolean).join(", ");
}
