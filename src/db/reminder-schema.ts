import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { appointment } from "./appointment-schema.js";

/*
 * Recordatorios de cita por email (src/lib/reminders.ts).
 *
 * Igual que la reserva online, tienen dos interruptores y hacen falta los dos:
 *   1. El super-admin activa la funcionalidad "reminders" (clinic_feature).
 *   2. La clínica los enciende en Configuración → Recordatorios
 *      (clinic_reminder_settings.enabled).
 *
 * A quién se envían: al email de cada paciente de la cita. Sale de la reserva
 * online, de su ficha o del que escribió la clínica al dar la cita
 * (appointment_patient.contact_email). Sin email, no hay recordatorio, y la
 * agenda lo señala.
 */

// Una fila por clínica. Sin fila = apagados y con los valores por defecto
export const clinicReminderSettings = pgTable(
  "clinic_reminder_settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    // "day_before": el día anterior a la hora sendTime (hora local de la clínica)
    // "hours_before": hoursBefore horas antes de la cita
    timing: text("timing").notNull().default("day_before"),
    sendTime: time("send_time").notNull().default("18:00"),
    hoursBefore: integer("hours_before").notNull().default(24),
    // El nombre del servicio puede decir algo de la salud del paciente
    // («Suelo pélvico»): por defecto no se incluye
    includeService: boolean("include_service").notNull().default(false),
    // A dónde llegan las respuestas del paciente. Vacío = el email de avisos de
    // la reserva online, si lo hay
    replyTo: text("reply_to"),
    // Texto de la clínica al final del email: dirección, qué traer…
    extraText: text("extra_text"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("clinic_reminder_timing_check", sql`${table.timing} in ('day_before', 'hours_before')`),
    check("clinic_reminder_hours_check", sql`${table.hoursBefore} between 1 and 72`),
  ],
);

// Cada recordatorio enviado (o que falló). Evita enviar dos veces el mismo:
// uno por cita, email y hora de inicio. Si la cita cambia de hora, el paciente
// recibe otro con la hora nueva
export const appointmentReminder = pgTable(
  "appointment_reminder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointment.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // La hora de la cita para la que se envió
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    // "sending" mientras sale, después "sent" o "failed"
    status: text("status").notNull().default("sending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("appointment_reminder_once").on(table.appointmentId, table.email, table.startsAt),
    index("appointment_reminder_appointment_idx").on(table.appointmentId),
  ],
);
