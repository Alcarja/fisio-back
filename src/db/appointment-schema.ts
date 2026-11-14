import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { room } from "./room-schema.js";
import { service } from "./service-schema.js";

/*
 * 4 y 5. Citas y pacientes de la cita (CALENDARIO.md)
 *
 * Fechas en UTC (timestamptz); se muestran en organization.timezone.
 * Las citas no se borran: se cancelan y el cambio queda en appointment_event.
 *
 * "El fisio no puede tener dos citas a la vez, en ninguna clínica": lo blinda
 * la exclusion constraint appointment_physio_no_overlap, que Drizzle no sabe
 * declarar. Está en src/db/sql/appointment-constraints.sql y se aplica con
 * `npm run db:constraints` después de `db:push`.
 *
 * Relaciones: appointment apunta a organization, user (fisio y quién la creó o
 * modificó), room y service. Cuelgan de ella appointment_patient y
 * appointment_event, que se borran con la cita.
 * Mapa completo: "Modelo de datos" en CALENDARIO.md.
 */

export const appointmentStatus = pgEnum("appointment_status", [
  "booked", // reservada
  "confirmed", // confirmada
  "completed", // realizada
  "no_show", // no se presentó
  "cancelled", // cancelada (con motivo)
]);

export const appointment = pgTable(
  "appointment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // El usuario, no la membresía: así el solapamiento se comprueba en todas sus clínicas
    physioId: text("physio_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").notNull().default("booked"),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Vistas del calendario: por clínica, por fisio y por sala en un rango de fechas
    index("appointment_org_starts_idx").on(table.organizationId, table.startsAt),
    index("appointment_physio_starts_idx").on(table.physioId, table.startsAt),
    index("appointment_room_starts_idx").on(table.roomId, table.startsAt),
    check("appointment_range_check", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "appointment_cancellation_check",
      sql`${table.status} <> 'cancelled' or ${table.cancellationReason} is not null`,
    ),
  ],
);

export const attendanceStatus = pgEnum("attendance_status", [
  "pending", // aún no ha pasado
  "attended", // vino
  "no_show", // no vino
]);

// Una fila por paciente y cita (varias en las sesiones en grupo).
// Sin ficha de paciente por ahora: nombre y apellidos escritos a mano.
// Cuando llegue la sección de pacientes, se añade aquí un patient_id opcional.
export const appointmentPatient = pgTable(
  "appointment_patient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointment.id, { onDelete: "cascade" }),
    // Repetido de la cita para filtrar siempre por clínica (datos personales)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    attendance: attendanceStatus("attendance").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("appointment_patient_appointment_idx").on(table.appointmentId),
    index("appointment_patient_org_idx").on(table.organizationId),
  ],
);

export const appointmentEventType = pgEnum("appointment_event_type", [
  "created",
  "updated", // hora, sala, fisio, servicio o notas
  "status_changed",
  "patients_changed",
]);

// Historial: quién cambió qué y cuándo
export const appointmentEvent = pgTable(
  "appointment_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointment.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: appointmentEventType("type").notNull(),
    // Campos cambiados: { campo: { from, to } }
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("appointment_event_appointment_idx").on(table.appointmentId, table.createdAt)],
);

export const appointmentRelations = relations(appointment, ({ one, many }) => ({
  organization: one(organization, {
    fields: [appointment.organizationId],
    references: [organization.id],
  }),
  physio: one(user, { fields: [appointment.physioId], references: [user.id] }),
  room: one(room, { fields: [appointment.roomId], references: [room.id] }),
  service: one(service, { fields: [appointment.serviceId], references: [service.id] }),
  patients: many(appointmentPatient),
  events: many(appointmentEvent),
}));

export const appointmentPatientRelations = relations(appointmentPatient, ({ one }) => ({
  appointment: one(appointment, {
    fields: [appointmentPatient.appointmentId],
    references: [appointment.id],
  }),
}));

export const appointmentEventRelations = relations(appointmentEvent, ({ one }) => ({
  appointment: one(appointment, {
    fields: [appointmentEvent.appointmentId],
    references: [appointment.id],
  }),
  changedByUser: one(user, { fields: [appointmentEvent.changedBy], references: [user.id] }),
}));
