import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { encryptedText } from "../lib/encryption.js";
import { organization, user } from "./auth-schema.js";

/*
 * Pacientes: la ficha de cada paciente de una clínica (cada clínica los suyos).
 *
 * Solo nombre y apellidos son obligatorios: el resto se puede completar
 * después. NIF y dirección harán falta para las facturas.
 * Tener ficha es opcional: una cita se puede dar solo con nombre y apellidos.
 *
 * Apunta aquí: appointment_patient.patientId (set null: si se borra la ficha,
 * las citas conservan el nombre que tenían) y patient_case.patientId
 * (restrict: una ficha con expedientes no se puede borrar).
 */

export const patient = pgTable(
  "patient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // restrict: una clínica con pacientes no se borra de golpe (antes se exporta)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    // NIF, NIE o pasaporte: sin validar el formato (hay pacientes extranjeros)
    nif: text("nif"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    // "AAAA-MM-DD"
    birthDate: date("birth_date"),
    // Notas internas de la clínica (administrativas, las ve también recepción).
    // Cifradas (src/lib/encryption.ts): pueden acabar hablando de salud
    notes: encryptedText("notes"),

    // Antecedentes: datos de salud que valen para todos los expedientes del
    // paciente (clinical-schema.ts). Solo los ve el personal clínico.
    // Cifrados en la base de datos (src/lib/encryption.ts)
    // Aviso destacado: "Marcapasos", "Anticoagulantes"…
    clinicalAlert: encryptedText("clinical_alert"),
    allergies: encryptedText("allergies"),
    medication: encryptedText("medication"),
    // Enfermedades, operaciones y lesiones anteriores
    medicalHistory: encryptedText("medical_history"),
    // Profesión y actividad física
    occupation: encryptedText("occupation"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // La lista siempre es por clínica, ordenada por apellidos
    index("patient_org_name_idx").on(table.organizationId, table.lastName, table.firstName),
  ],
);
