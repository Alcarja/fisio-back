import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";

/*
 * Funcionalidades opcionales por clínica (super-admin). Una fila = esa
 * funcionalidad está activada en esa clínica. Sin fila = desactivada.
 *
 * Las claves válidas están en src/lib/features.ts (CLINIC_FEATURES).
 */

export const clinicFeature = pgTable(
  "clinic_feature",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Clave de la funcionalidad, p. ej. "invoicing"
    feature: text("feature").notNull(),
    // Cuándo se activó, y quién
    enabledAt: timestamp("enabled_at", { withTimezone: true }).defaultNow().notNull(),
    enabledBy: text("enabled_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.feature] })],
);
