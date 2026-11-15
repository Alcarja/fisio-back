import { customType, date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";

/*
 * Documentación de cada clínica (super-admin): lo que Kineflow necesita de una
 * clínica para darle servicio y tratar los datos de sus pacientes.
 *
 * - clinic_legal: una fila por clínica con sus datos legales (el titular que
 *   firma los contratos y el contacto para protección de datos).
 * - clinic_document: los documentos firmados (contrato de servicio, contrato
 *   de encargo del tratamiento…). El archivo se guarda aquí, en la base de
 *   datos: son pocos PDF pequeños y así van en las mismas copias de seguridad.
 *
 * Los tipos de documento y cuáles son obligatorios están en
 * src/lib/clinicDocuments.ts.
 */

// Contenido binario del archivo (Drizzle no trae el tipo bytea)
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const clinicLegal = pgTable("clinic_legal", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // Titular: la sociedad o el autónomo que firma (no el nombre comercial)
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  // Quién firma en nombre de la clínica
  signerName: text("signer_name"),
  // A quién avisar de cualquier asunto de protección de datos (p. ej. una brecha)
  privacyContactName: text("privacy_contact_name"),
  privacyContactEmail: text("privacy_contact_email"),
  privacyContactPhone: text("privacy_contact_phone"),
  // Delegado de protección de datos, si la clínica tiene uno
  dpoContact: text("dpo_contact"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const clinicDocument = pgTable(
  "clinic_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Clave de src/lib/clinicDocuments.ts: "service_contract", "dpa"…
    type: text("type").notNull(),
    // Descripción libre, sobre todo para los de tipo "other"
    title: text("title"),
    // Fecha de la firma
    signedAt: date("signed_at"),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull(),
    fileData: bytea("file_data").notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("clinic_document_org_idx").on(table.organizationId)],
);
