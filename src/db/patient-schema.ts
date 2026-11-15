import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
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
    // Notas internas de la clínica (administrativas, las ve también recepción)
    notes: text("notes"),

    // Antecedentes: datos de salud que valen para todos los expedientes del
    // paciente (clinical-schema.ts). Solo los ve el personal clínico
    // Aviso destacado: "Marcapasos", "Anticoagulantes"…
    clinicalAlert: text("clinical_alert"),
    allergies: text("allergies"),
    medication: text("medication"),
    // Enfermedades, operaciones y lesiones anteriores
    medicalHistory: text("medical_history"),
    // Profesión y actividad física
    occupation: text("occupation"),
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
