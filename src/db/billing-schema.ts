import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";

/*
 * Pagos de las clínicas (super-admin). Seguimiento manual: el super-admin
 * marca cada mes si la clínica ha pagado. Kineflow no cobra nada por sí mismo.
 *
 * - clinic_billing: una fila por clínica con sus ajustes de cobro. Sin fila =
 *   valores por defecto (sí tiene que pagar).
 * - clinic_payment: una fila por mes pagado. Sin fila = ese mes no está pagado.
 */

export const clinicBilling = pgTable("clinic_billing", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // "No tiene que pagar": no cuenta como pendiente en ningún mes
  exempt: boolean("exempt").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const clinicPayment = pgTable(
  "clinic_payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Mes pagado, "2026-11"
    month: text("month").notNull(),
    // Cuándo se marcó como pagado, y quién
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("clinic_payment_org_idx").on(table.organizationId),
    // Un mes solo se paga una vez
    unique("clinic_payment_org_month_unique").on(table.organizationId, table.month),
    check("clinic_payment_month_check", sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ],
);
