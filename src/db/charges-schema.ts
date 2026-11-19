import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { appointmentPatient } from "./appointment-schema.js";
import { bono } from "./bono-schema.js";
import { organization, user } from "./auth-schema.js";
import { patient } from "./patient-schema.js";
import { service } from "./service-schema.js";

/*
 * Cobros y bonos de las clínicas (COBROS.md). Funcionalidad "invoicing".
 *
 * No son facturas: es el registro interno de lo que cobra la clínica a sus
 * pacientes. Las facturas las sigue haciendo la clínica con su gestoría.
 */

// Ajustes de cobros de cada clínica. Sin fila = valores por defecto
// (src/lib/charges.ts → getChargeSettings)
export const clinicChargeSettings = pgTable("clinic_charge_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // Desde qué día cuentan las sesiones ("AAAA-MM-DD", día de la clínica). Lo
  // anterior no sale como pendiente de cobro. Sin fila: el día en que el
  // super-admin activó la funcionalidad
  startsOn: date("starts_on").notNull(),
  // Las faltas (no se presentó) generan cargo y gastan sesión del bono
  chargeNoShows: boolean("charge_no_shows").notNull().default(false),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Un cobro (o una devolución). Nunca se borra: se anula, con motivo
export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // "sessions": cobro de una o varias sesiones (session_charge.payment_id)
    // "bono": venta de un bono (bono_id)
    // "refund": devolución de una o más sesiones de otro cobro (refund_of_id),
    // con importe negativo. Las sesiones devueltas quedan libres
    kind: text("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // "cash" | "card" | "bizum" | "transfer" | "other"
    method: text("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    // Quién pagó: copia del paciente de las sesiones. null si eran de varios
    patientId: uuid("patient_id").references(() => patient.id, { onDelete: "set null" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    note: text("note"),
    refundOfId: uuid("refund_of_id").references((): AnyPgColumn => payment.id, {
      onDelete: "restrict",
    }),
    // El bono que se paga (kind = 'bono'). Los bonos no se borran
    bonoId: uuid("bono_id").references((): AnyPgColumn => bono.id, { onDelete: "restrict" }),
    // Anulado: fue un error, como si no hubiera existido (no cuenta en la caja)
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payment_org_paid_idx").on(table.organizationId, table.paidAt),
    // Devoluciones de un cobro (puede tener varias: se devuelve por sesiones)
    index("payment_refund_of_idx").on(table.refundOfId),
    check("payment_kind_check", sql`${table.kind} in ('sessions', 'refund', 'bono')`),
    check("payment_bono_check", sql`(${table.kind} = 'bono') = (${table.bonoId} is not null)`),
    index("payment_bono_idx").on(table.bonoId),
    check(
      "payment_method_check",
      sql`${table.method} in ('cash', 'card', 'bizum', 'transfer', 'other')`,
    ),
    check(
      "payment_amount_check",
      sql`(${table.kind} = 'refund' and ${table.amountCents} < 0 and ${table.refundOfId} is not null)
        or (${table.kind} <> 'refund' and ${table.amountCents} > 0 and ${table.refundOfId} is null)`,
    ),
    check("payment_void_check", sql`${table.voidedAt} is null or ${table.voidReason} is not null`),
  ],
);

// Una sesión con algo que guardar para el cobro: su precio congelado, su
// cobro o el motivo por el que no se cobra. Las sesiones de la agenda solo
// tienen fila desde que se cobran, se perdonan o se les cambia el precio;
// antes se calculan de la cita (src/lib/charges.ts)
export const sessionCharge = pgTable(
  "session_charge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // "calendar": un paciente de una cita · "manual": sesión fuera de la agenda (H3)
    source: text("source").notNull().default("calendar"),
    // set null: si el paciente sale de la cita, la fila (y su cobro) se quedan
    // y la sesión pasa a "a revisar"
    appointmentPatientId: uuid("appointment_patient_id")
      .unique()
      .references(() => appointmentPatient.id, { onDelete: "set null" }),
    // Copias, para seguir mostrándola aunque la cita cambie o desaparezca
    patientId: uuid("patient_id").references(() => patient.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // set null: borrar un servicio nunca se bloquea por Cobros (con la
    // funcionalidad apagada ni se ve). El nombre queda copiado al lado
    serviceId: uuid("service_id").references(() => service.id, { onDelete: "set null" }),
    serviceName: text("service_name"),
    physioId: text("physio_id").references(() => user.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    priceCents: integer("price_cents").notNull(),
    paymentId: uuid("payment_id").references(() => payment.id, { onDelete: "restrict" }),
    // Pagada con un bono (H6): gasta una sesión suya. Si la cita se cancela o
    // el paciente sale de ella, deja de contar y vuelve al bono sola
    bonoId: uuid("bono_id").references((): AnyPgColumn => bono.id, { onDelete: "restrict" }),
    // Se pasó del límite semanal del bono mensual a sabiendas (con motivo)
    overLimitReason: text("over_limit_reason"),
    // "Sin cargo" decidido por la clínica (con motivo)
    waivedReason: text("waived_reason"),
    waivedBy: text("waived_by").references(() => user.id, { onDelete: "set null" }),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    // Sesiones manuales: por qué no está en la agenda (obligatorio)
    note: text("note"),
    // Sesión manual anulada (las de la agenda se cancelan en la cita). Si
    // estaba cobrada, pasa a "a revisar"
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("session_charge_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("session_charge_payment_idx").on(table.paymentId),
    index("session_charge_bono_idx").on(table.bonoId),
    // Una sesión se paga de una sola forma: con un cobro, con un bono o sin cargo
    check(
      "session_charge_one_way_check",
      sql`(case when ${table.paymentId} is not null then 1 else 0 end
         + case when ${table.bonoId} is not null then 1 else 0 end
         + case when ${table.waivedReason} is not null then 1 else 0 end) <= 1`,
    ),
    check("session_charge_source_check", sql`${table.source} in ('calendar', 'manual')`),
    check("session_charge_price_check", sql`${table.priceCents} >= 0`),
    // Una sesión manual no apunta a ninguna cita y lleva su motivo
    check(
      "session_charge_manual_check",
      sql`${table.source} <> 'manual' or (${table.appointmentPatientId} is null and ${table.note} is not null)`,
    ),
    check(
      "session_charge_cancel_check",
      sql`${table.cancelledAt} is null or (${table.source} = 'manual' and ${table.cancelReason} is not null)`,
    ),
    check(
      "session_charge_paid_or_waived_check",
      sql`${table.paymentId} is null or ${table.waivedReason} is null`,
    ),
  ],
);

// Historial de cobros y sesiones: quién hizo qué y cuándo
export const billingEvent = pgTable(
  "billing_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // "payment" | "session"
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    // "paid", "voided", "refunded", "moved", "price_changed", "waived", "unwaived"…
    action: text("action").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("billing_event_entity_idx").on(table.entity, table.entityId, table.createdAt)],
);
