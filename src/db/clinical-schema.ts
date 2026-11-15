import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { patient } from "./patient-schema.js";

/*
 * Historia clínica del paciente: expedientes y notas de evolución.
 *
 * - patient_case: un expediente por lesión o motivo de consulta. Un paciente
 *   puede tener varios abiertos a la vez (hombro sin resolver + rodilla nueva).
 * - case_note: la evolución, una nota por sesión, con el dolor (EVA 0-10).
 *
 * Los antecedentes generales (alergias, medicación…) están en la propia ficha
 * (patient-schema.ts), porque valen para todos los expedientes.
 *
 * Son datos de salud: solo los ven propietario, administradores y fisios
 * (CLINICAL_ROLES en src/lib/clinical.ts), nunca recepción.
 * Un paciente con expedientes no se puede borrar (restrict): la historia
 * clínica hay que conservarla.
 */

export const caseStatus = pgEnum("case_status", ["open", "closed"]);

export const patientCase = pgTable(
  "patient_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patient.id, { onDelete: "restrict" }),
    // "Tendinopatía del supraespinoso"
    title: text("title").notNull(),
    // Zona del cuerpo y lado: claves de src/lib/clinical.ts
    bodyRegion: text("body_region").notNull(),
    side: text("side"),
    status: caseStatus("status").notNull().default("open"),
    // Fisio responsable del expediente
    physioId: text("physio_id").references(() => user.id, { onDelete: "set null" }),
    // Motivo de consulta, en palabras del paciente
    reason: text("reason"),
    diagnosis: text("diagnosis"),
    // Objetivos y plan de tratamiento
    plan: text("plan"),
    // Cuándo empezó la lesión (no cuándo se abrió el expediente)
    onsetDate: date("onset_date"),
    openedAt: date("opened_at").notNull(),
    // Solo en los cerrados: cuándo, con qué resultado y un comentario
    closedAt: date("closed_at"),
    closeOutcome: text("close_outcome"),
    closeNotes: text("close_notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("patient_case_patient_idx").on(table.patientId),
    index("patient_case_org_idx").on(table.organizationId),
    // Cerrado = con fecha y resultado; abierto = sin ellos
    check(
      "patient_case_closed_check",
      sql`(${table.status} = 'closed') = (${table.closedAt} is not null and ${table.closeOutcome} is not null)`,
    ),
  ],
);

export const caseNote = pgTable(
  "case_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Repetido del expediente para filtrar siempre por clínica (datos de salud)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => patientCase.id, { onDelete: "cascade" }),
    // Día de la sesión
    date: date("date").notNull(),
    // Dolor según el paciente, escala EVA: 0 (nada) a 10 (máximo)
    painLevel: integer("pain_level"),
    text: text("text").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Distinto de createdAt = la nota se editó después
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("case_note_case_idx").on(table.caseId, table.date),
    check(
      "case_note_pain_check",
      sql`${table.painLevel} is null or ${table.painLevel} between 0 and 10`,
    ),
  ],
);
