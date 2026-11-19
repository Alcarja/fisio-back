import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { type AnyPgColumn, date } from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { patient } from "./patient-schema.js";
import { service } from "./service-schema.js";

/*
 * Bonos (COBROS.md, H4–H7). Parte de la funcionalidad "invoicing" (Cobros y
 * bonos): se apagan con ella. Como el resto de Cobros, estas tablas apuntan a
 * las de la clínica (servicios, pacientes…) y nunca al revés: borrar un
 * servicio o una ficha no se bloquea por un bono.
 */

// Tipos de bono que vende la clínica (Configuración → Cobros). Cambiar un
// tipo no cambia los bonos ya vendidos: cada bono copia lo que necesita
export const bonoType = pgTable(
  "bono_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Cada bono es de un único servicio. set null: si el servicio se borra,
    // el tipo queda sin servicio y no se puede vender (su nombre queda copiado)
    serviceId: uuid("service_id").references(() => service.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull(),
    // "sessions": X sesiones, con caducidad opcional
    // "monthly": un mes natural, con o sin límite de sesiones por semana
    kind: text("kind").notNull(),
    sessions: integer("sessions"),
    // Días que dura desde que se vende. null = no caduca (solo "sessions")
    validityDays: integer("validity_days"),
    // Sesiones por semana (lunes a domingo). null = sin límite (solo "monthly")
    sessionsPerWeek: integer("sessions_per_week"),
    priceCents: integer("price_cents").notNull(),
    // Los tipos con bonos vendidos no se borran: se desactivan
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("bono_type_org_idx").on(table.organizationId),
    unique("bono_type_org_name_unique").on(table.organizationId, table.name),
    check("bono_type_kind_check", sql`${table.kind} in ('sessions', 'monthly')`),
    check("bono_type_price_check", sql`${table.priceCents} > 0`),
    check(
      "bono_type_shape_check",
      sql`(${table.kind} = 'sessions' and ${table.sessions} between 1 and 200
            and ${table.sessionsPerWeek} is null
            and (${table.validityDays} is null or ${table.validityDays} between 1 and 1095))
       or (${table.kind} = 'monthly' and ${table.sessions} is null and ${table.validityDays} is null
            and (${table.sessionsPerWeek} is null or ${table.sessionsPerWeek} between 1 and 14))`,
    ),
  ],
);

// Un bono vendido a una persona. Nunca se borra: se anula (con motivo).
// Copia lo que necesita del tipo, que puede cambiar o borrarse después.
// Pagado = tiene un cobro (payment.kind = 'bono') sin anular; si no, está
// pendiente de pago, pero se puede usar igualmente
export const bono = pgTable(
  "bono",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // null: bono a medida, o su tipo se borró
    bonoTypeId: uuid("bono_type_id").references(() => bonoType.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    serviceId: uuid("service_id").references(() => service.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull(),
    // Titular: su ficha, o nombre y apellidos con un teléfono o email para
    // distinguirlo (los bonos sin ficha se descuentan siempre a mano)
    patientId: uuid("patient_id").references(() => patient.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    contact: text("contact"),
    // "sessions": cuántas sesiones · "monthly": límite por semana (null = sin límite)
    totalSessions: integer("total_sessions"),
    sessionsPerWeek: integer("sessions_per_week"),
    // Días en que vale ("AAAA-MM-DD", ambos incluidos, día de la clínica).
    // Mensual: del 1 al último día del mes. De sesiones: hasta null = no caduca
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    priceCents: integer("price_cents").notNull(),
    note: text("note"),
    // Renovación del bono mensual del mes anterior (H7b)
    renewedFromId: uuid("renewed_from_id").references((): AnyPgColumn => bono.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bono_org_idx").on(table.organizationId, table.validFrom),
    index("bono_patient_idx").on(table.patientId),
    check("bono_kind_check", sql`${table.kind} in ('sessions', 'monthly')`),
    check("bono_price_check", sql`${table.priceCents} > 0`),
    check(
      "bono_shape_check",
      sql`(${table.kind} = 'sessions' and ${table.totalSessions} between 1 and 200 and ${table.sessionsPerWeek} is null)
       or (${table.kind} = 'monthly' and ${table.totalSessions} is null and ${table.validUntil} is not null
           and (${table.sessionsPerWeek} is null or ${table.sessionsPerWeek} between 1 and 14))`,
    ),
    check(
      "bono_dates_check",
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
    check("bono_cancel_check", sql`${table.cancelledAt} is null or ${table.cancelReason} is not null`),
  ],
);
