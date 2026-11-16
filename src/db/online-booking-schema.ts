import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { member, organization, user } from "./auth-schema.js";

/*
 * Reserva online: los pacientes piden cita ellos mismos (enlace o QR).
 *
 * Tiene dos interruptores, y hacen falta los dos:
 *   1. El super-admin activa la funcionalidad "online_booking" en la clínica
 *      (clinic_feature). Sin ella, la sección no existe.
 *   2. La clínica la enciende o apaga en Configuración → Reserva online
 *      (clinic_online_booking.enabled). Si el super-admin la desactiva, este
 *      valor se conserva pero deja de tener efecto.
 * La regla está en src/lib/onlineBooking.ts (getOnlineBookingStatus).
 */

// Una fila por clínica. Sin fila = apagada y con los criterios por defecto.
// Los criterios solo afectan a las reservas online: desde la agenda, la clínica
// da y cancela citas sin estos límites.
// Valores por defecto y límites: src/lib/onlineBooking.ts
export const clinicOnlineBooking = pgTable(
  "clinic_online_booking",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),

    // Criterios de reserva
    // Antelación mínima: no se puede reservar para dentro de menos de esto
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(120),
    // Hasta cuántos días vista se puede reservar
    maxDaysAhead: integer("max_days_ahead").notNull().default(60),
    // Cada cuánto se ofrece una hora de inicio (09:00, 09:30…)
    slotStepMinutes: integer("slot_step_minutes").notNull().default(30),

    // Criterios de cancelación
    // ¿Puede el paciente cancelar él mismo con el enlace de su reserva?
    cancelEnabled: boolean("cancel_enabled").notNull().default(true),
    // Hasta cuántas horas antes de la cita. 0 = hasta que empiece
    cancelNoticeHours: integer("cancel_notice_hours").notNull().default(24),
    // Texto libre que ve el paciente al reservar y en el email (política de
    // cancelación, qué traer…)
    policyText: text("policy_text"),

    // Avisos: a dónde se avisa a la clínica de cada reserva o cancelación
    // online, y a dónde llegan las respuestas del paciente a su email de
    // confirmación. Vacío = no se avisa a nadie
    notifyEmail: text("notify_email"),

    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("clinic_online_booking_notice_check", sql`${table.minNoticeMinutes} >= 0`),
    check("clinic_online_booking_days_check", sql`${table.maxDaysAhead} >= 1`),
    check("clinic_online_booking_step_check", sql`${table.slotStepMinutes} >= 5`),
    check("clinic_online_booking_cancel_check", sql`${table.cancelNoticeHours} >= 0`),
  ],
);

// Franjas semanales en las que un profesional acepta reservas online.
// Mismo formato que clinic_opening_hours: hora local de la clínica, días ISO
// (1 = lunes … 7 = domingo), varias franjas por día.
// Un día sin franjas = cerrado. Un profesional sin ninguna fila = no se puede
// reservar online con él (las citas que da la clínica no dependen de esto).
//
// Cuelga de member y no de user: el horario es de esa persona EN esa clínica,
// y se borra solo si deja de pertenecer a ella.
export const physioBookingHours = pgTable(
  "physio_booking_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Repetido del miembro para filtrar siempre por clínica
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("physio_booking_hours_org_idx").on(table.organizationId),
    index("physio_booking_hours_member_weekday_idx").on(table.memberId, table.weekday),
    check("physio_booking_hours_weekday_check", sql`${table.weekday} between 1 and 7`),
    check("physio_booking_hours_time_check", sql`${table.startTime} < ${table.endTime}`),
  ],
);

export const physioBookingHoursRelations = relations(physioBookingHours, ({ one }) => ({
  member: one(member, { fields: [physioBookingHours.memberId], references: [member.id] }),
}));
