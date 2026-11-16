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
import { encryptedJson, encryptedText } from "../lib/encryption.js";
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
 * Los textos (título, motivo, diagnóstico, plan, notas…) se guardan cifrados
 * (encryptedText, src/lib/encryption.ts): no se pueden buscar ni ordenar en SQL.
 * Un paciente con expedientes no se puede borrar (restrict): la historia
 * clínica hay que conservarla. Por lo mismo, una clínica con expedientes
 * tampoco (restrict en organizationId): antes hay que exportarla.
 *
 * - clinical_log: quién ha visto, cambiado o exportado la historia de cada
 *   paciente, y cómo era lo que se cambió (src/lib/clinicalLog.ts).
 */

export const caseStatus = pgEnum("case_status", ["open", "closed"]);

export const patientCase = pgTable(
  "patient_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patient.id, { onDelete: "restrict" }),
    // "Tendinopatía del supraespinoso"
    title: encryptedText("title").notNull(),
    // Zona del cuerpo y lado: claves de src/lib/clinical.ts
    bodyRegion: text("body_region").notNull(),
    side: text("side"),
    status: caseStatus("status").notNull().default("open"),
    // Fisio responsable del expediente
    physioId: text("physio_id").references(() => user.id, { onDelete: "set null" }),
    // Motivo de consulta, en palabras del paciente
    reason: encryptedText("reason"),
    diagnosis: encryptedText("diagnosis"),
    // Objetivos y plan de tratamiento
    plan: encryptedText("plan"),
    // Cuándo empezó la lesión (no cuándo se abrió el expediente)
    onsetDate: date("onset_date"),
    openedAt: date("opened_at").notNull(),
    // Solo en los cerrados: cuándo, con qué resultado y un comentario
    closedAt: date("closed_at"),
    closeOutcome: text("close_outcome"),
    closeNotes: encryptedText("close_notes"),
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
      .references(() => organization.id, { onDelete: "restrict" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => patientCase.id, { onDelete: "cascade" }),
    // Día de la sesión
    date: date("date").notNull(),
    // Dolor según el paciente, escala EVA: 0 (nada) a 10 (máximo)
    painLevel: integer("pain_level"),
    text: encryptedText("text").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Distinto de createdAt = la nota se editó después
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Las notas no se borran: se marcan y dejan de verse en el expediente.
    // Siguen en la exportación y en el registro (clinical_log)
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("case_note_case_idx").on(table.caseId, table.date),
    check(
      "case_note_pain_check",
      sql`${table.painLevel} is null or ${table.painLevel} between 0 and 10`,
    ),
  ],
);

// Registro de la historia clínica: una fila por cada vez que alguien la ve, la
// cambia o la exporta. Solo se añade: nunca se edita ni se borra desde la app.
export const clinicalLog = pgTable(
  "clinical_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    // Sin clave foránea: la fila sigue aquí aunque se borre la ficha.
    // null en la exportación de toda la clínica
    patientId: uuid("patient_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // El nombre que tenía entonces, por si la cuenta se borra
    userName: text("user_name").notNull(),
    // "view" | "create" | "update" | "delete" | "export"
    action: text("action").notNull(),
    // "record" (la historia entera) | "background" | "case" | "note" | "clinic"
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    // En los cambios: qué campos cambiaron…
    fields: text("fields").array(),
    // …y qué valor tenían antes (el historial de versiones). Cifrado: son los
    // mismos textos clínicos
    previous: encryptedJson("previous"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("clinical_log_patient_idx").on(table.organizationId, table.patientId, table.createdAt),
  ],
);
