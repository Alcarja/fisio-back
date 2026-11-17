import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { encryptedText } from "../lib/encryption.js";
import { organization, user } from "./auth-schema.js";
import { patientCase } from "./clinical-schema.js";
import { patient } from "./patient-schema.js";

/*
 * Ejercicios para casa (src/lib/exercises.ts). Tres niveles:
 *
 * - exercise: el banco. Los de una clínica (organizationId) y los del banco
 *   base de Kineflow (organizationId null, baseKey; los carga
 *   `npm run db:seed-exercises`). Las clínicas no editan los base: los duplican.
 *   No se borran, se archivan: los programas pueden seguir mostrando su imagen.
 * - exercise_template: las «tablas» de la clínica, reutilizables.
 * - exercise_program: lo que se pauta a un paciente dentro de un expediente.
 *   Sus ejercicios son una copia (nombre, instrucciones, dosis): si después
 *   cambian el banco o la tabla, lo pautado no cambia. El paciente lo ve en
 *   /ejercicios/:accessToken mientras está activo.
 *
 * El banco y las tablas no son datos de pacientes. Los programas sí (forman
 * parte de la historia clínica): sus notas se guardan cifradas y cada cambio
 * queda en clinical_log.
 */

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const exercise = pgTable(
  "exercise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null = banco base de Kineflow, visible para todas las clínicas
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    // Solo en el banco base: clave fija para poder actualizarlo
    baseKey: text("base_key").unique(),
    name: text("name").notNull(),
    // Claves de src/lib/clinical.ts (BODY_REGIONS) y src/lib/exercises.ts
    bodyRegions: text("body_regions").array().notNull(),
    type: text("type").notNull(),
    equipment: text("equipment").array().notNull(),
    // Pasos, uno por línea
    instructions: text("instructions").notNull(),
    precautions: text("precautions"),
    // Dosis por defecto. Repeticiones o segundos (isométricos, estiramientos)
    defaultSets: integer("default_sets"),
    defaultReps: integer("default_reps"),
    defaultSeconds: integer("default_seconds"),
    defaultRestSeconds: integer("default_rest_seconds"),
    perSide: boolean("per_side").notNull().default(false),
    imageType: text("image_type"),
    imageData: bytea("image_data"),
    archived: boolean("archived").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("exercise_org_idx").on(table.organizationId),
    check("exercise_base_check", sql`(${table.organizationId} is null) = (${table.baseKey} is not null)`),
  ],
);

// Dosis de un ejercicio dentro de una tabla o de un programa
const doseColumns = {
  sets: integer("sets"),
  reps: integer("reps"),
  seconds: integer("seconds"),
  restSeconds: integer("rest_seconds"),
  perSide: boolean("per_side").notNull().default(false),
  position: integer("position").notNull(),
};

export const exerciseTemplate = pgTable(
  "exercise_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // «1 vez al día, 5 días a la semana»
    frequency: text("frequency"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("exercise_template_org_idx").on(table.organizationId)],
);

export const exerciseTemplateItem = pgTable(
  "exercise_template_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => exerciseTemplate.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "cascade" }),
    notes: text("notes"),
    ...doseColumns,
  },
  (table) => [index("exercise_template_item_template_idx").on(table.templateId)],
);

export const exerciseProgram = pgTable(
  "exercise_program",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // restrict, como la historia clínica: no se pierde con la clínica
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patient.id, { onDelete: "restrict" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => patientCase.id, { onDelete: "restrict" }),
    // "active" (el paciente lo ve) o "finished"
    status: text("status").notNull().default("active"),
    frequency: text("frequency"),
    // Indicaciones para el paciente: las ve en su página
    notes: encryptedText("notes"),
    startDate: date("start_date").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // La clave de la página del paciente. Larga y aleatoria
    accessToken: text("access_token").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("exercise_program_case_idx").on(table.caseId),
    index("exercise_program_patient_idx").on(table.organizationId, table.patientId),
    check("exercise_program_status_check", sql`${table.status} in ('active', 'finished')`),
  ],
);

export const exerciseProgramItem = pgTable(
  "exercise_program_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => exerciseProgram.id, { onDelete: "cascade" }),
    // De dónde salió (para su imagen). El texto es una copia
    exerciseId: uuid("exercise_id").references(() => exercise.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull(),
    precautions: text("precautions"),
    // Indicación para este paciente en este ejercicio
    notes: encryptedText("notes"),
    ...doseColumns,
  },
  (table) => [index("exercise_program_item_program_idx").on(table.programId)],
);
