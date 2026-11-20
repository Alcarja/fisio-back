import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { plan } from "./plan-schema.js";

/*
 * Pagos de las clínicas (super-admin). Seguimiento manual: el super-admin
 * marca cada mes si la clínica ha pagado. Kineflow no cobra nada por sí mismo.
 *
 * - clinic_billing: una fila por clínica con su contrato: plan, ciclo de pago,
 *   profesionales, descuento… (planes y precios: plan-schema.ts, src/lib/plans.ts).
 *   Sin fila = sin plan asignado y sí tiene que pagar.
 * - clinic_payment: una fila por mes pagado. Sin fila = ese mes no está pagado.
 */

export const clinicBilling = pgTable("clinic_billing", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // "No tiene que pagar": no cuenta como pendiente en ningún mes
  exempt: boolean("exempt").notNull().default(false),
  // Su plan. restrict: un plan con clínicas no se borra, se archiva
  planId: uuid("plan_id").references(() => plan.id, { onDelete: "restrict" }),
  // "monthly" o "annual" (paga 12 meses de una vez, con el descuento del plan)
  cycle: text("cycle").notNull().default("monthly"),
  // Profesionales que cuentan para el precio. null = los que tiene (propietarios,
  // administradores y fisios; recepción no cuenta)
  professionalsOverride: integer("professionals_override"),
  // Descuento sobre el total (p. ej. 20 % por segundo centro) y por qué
  discountPercent: integer("discount_percent").notNull().default(0),
  discountNote: text("discount_note"),
  // Precio pactado del plan al mes, en lugar del de su tramo. null = el de la tabla
  priceOverrideCents: integer("price_override_cents"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  check("clinic_billing_cycle_check", sql`${table.cycle} in ('monthly', 'annual')`),
  check("clinic_billing_discount_check", sql`${table.discountPercent} between 0 and 100`),
  check("clinic_billing_professionals_check", sql`${table.professionalsOverride} is null or ${table.professionalsOverride} >= 1`),
  check("clinic_billing_price_check", sql`${table.priceOverrideCents} is null or ${table.priceOverrideCents} >= 0`),
]);

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
    // Lo que se cobró ese mes, guardado al marcarlo: cambiar precios o planes
    // después no reescribe lo ya cobrado. null en los meses marcados antes de
    // guardarlo (se calcula con el contrato actual)
    amountCents: integer("amount_cents"),
    planName: text("plan_name"),
    professionals: integer("professionals"),
  },
  (table) => [
    index("clinic_payment_org_idx").on(table.organizationId),
    // Un mes solo se paga una vez
    unique("clinic_payment_org_month_unique").on(table.organizationId, table.month),
    check("clinic_payment_month_check", sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
  ],
);
