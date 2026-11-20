import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";

/*
 * Planes y precios de Kineflow (super-admin → Planes). Todo editable desde el
 * panel; los valores de partida salen de PRICING.md (`npm run db:seed-plans`).
 * Kineflow no cobra nada por sí mismo: esto dice qué tiene contratado cada
 * clínica y cuánto le toca pagar (src/lib/plans.ts).
 *
 * - plan: cada plan, con su precio al mes por número de profesionales.
 * - plan_feature: las funcionalidades (src/lib/features.ts) que incluye.
 * - feature_price: lo que cuesta una funcionalidad contratada fuera del plan.
 * - clinic_addon: las funcionalidades que una clínica tiene contratadas
 *   fuera de su plan (extras), con un precio especial si se pactó.
 * El plan de cada clínica, el ciclo de pago y los descuentos están en
 * clinic_billing (billing-schema.ts).
 */

// Precio al mes hasta `upTo` profesionales (incluido). Ordenados de menos a más
export type PriceTier = { upTo: number; cents: number };

export const plan = pgTable(
  "plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description"),
    // Orden en las listas
    position: integer("position").notNull().default(0),
    priceTiers: jsonb("price_tiers").$type<PriceTier[]>().notNull(),
    // Por cada profesional por encima del último tramo
    extraProfessionalCents: integer("extra_professional_cents").notNull().default(0),
    // Pago anual: cuántos meses se cobran por 12 (10 = dos meses gratis).
    // Vale también para los extras de las clínicas con este plan
    annualMonths: integer("annual_months").notNull().default(12),
    // Archivado: no se puede asignar a clínicas nuevas; las que lo tienen lo conservan
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("plan_annual_months_check", sql`${table.annualMonths} between 1 and 12`),
    check("plan_extra_professional_check", sql`${table.extraProfessionalCents} >= 0`),
  ],
);

export const planFeature = pgTable(
  "plan_feature",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    // Clave de src/lib/features.ts
    feature: text("feature").notNull(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.feature] })],
);

export const featurePrice = pgTable(
  "feature_price",
  {
    feature: text("feature").primaryKey(),
    // Al mes. null = sin precio todavía (se avisa en el panel)
    monthlyCents: integer("monthly_cents"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [check("feature_price_check", sql`${table.monthlyCents} is null or ${table.monthlyCents} >= 0`)],
);

export const clinicAddon = pgTable(
  "clinic_addon",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    // Precio especial al mes para esta clínica. null = el de feature_price
    priceCents: integer("price_cents"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.feature] }),
    check("clinic_addon_price_check", sql`${table.priceCents} is null or ${table.priceCents} >= 0`),
  ],
);

// Historial de profesionales de cada clínica: una fila cada vez que cambia
// cuántos tiene (propietarios, administradores y fisios; recepción no cuenta).
// La escribe un trigger de la tabla member (src/db/sql/professional-log.sql),
// así que recoge cualquier cambio: altas, invitaciones aceptadas, cambios de
// rol, bajas, cuentas borradas… venga de donde venga. Sirve para:
// - el precio de cada mes: cuenta los profesionales que había el día 1 (un
//   alta a mitad de mes se cobra desde el mes siguiente), src/lib/plans.ts
// - avisar al super-admin de los cambios de tramo hasta que los revise
export const clinicProfessionalLog = pgTable(
  "clinic_professional_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    previousCount: integer("previous_count").notNull(),
    newCount: integer("new_count").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    // El super-admin lo ha visto (Suscripciones → Contratos)
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [index("clinic_professional_log_org_idx").on(table.organizationId, table.changedAt)],
);
