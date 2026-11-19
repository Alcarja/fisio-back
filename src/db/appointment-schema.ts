import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";
import { patient } from "./patient-schema.js";
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

// Quién dio la cita: el personal desde la agenda, o el paciente con la reserva
// online (src/controllers/publicBooking.controller.ts)
export const appointmentSource = pgEnum("appointment_source", ["staff", "online"]);

export const appointment = pgTable(
  "appointment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // El usuario, no la membresía: así el solapamiento se comprueba en todas sus clínicas.
    // null solo en sesiones de una clase de grupo creada sin fisio (R3): se
    // asigna después. Las citas individuales siempre tienen fisio
    physioId: text("physio_id").references(() => user.id, { onDelete: "restrict" }),
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
    source: appointmentSource("source").notNull().default("staff"),
    // Solo en las reservas online: cómo localizar a quien reservó. Van en la
    // cita (y no en appointment_patient) para que no se pierdan al editarla
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    // Solo en las reservas online: la clave del enlace con el que el paciente
    // ve y cancela su cita. Larga y aleatoria; no se envía a la agenda
    cancelToken: text("cancel_token"),
    // Citas que se repiten (COBROS.md, R1–R3): la serie de la que salió.
    // set null: si la serie desaparece, las citas se quedan como sueltas
    seriesId: uuid("series_id").references((): AnyPgColumn => appointmentSeries.id, {
      onDelete: "set null",
    }),
    // Cambiada a mano (otra hora, otro día…): ya no sigue a su serie cuando se
    // cambian "esta y las siguientes" o "todas"
    detached: boolean("detached").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("appointment_series_idx").on(table.seriesId, table.startsAt),
    // Vistas del calendario: por clínica, por fisio y por sala en un rango de fechas
    index("appointment_org_starts_idx").on(table.organizationId, table.startsAt),
    index("appointment_physio_starts_idx").on(table.physioId, table.startsAt),
    index("appointment_room_starts_idx").on(table.roomId, table.startsAt),
    // The patient's link looks the appointment up by its key
    index("appointment_cancel_token_idx").on(table.cancelToken),
    check("appointment_range_check", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "appointment_cancellation_check",
      sql`${table.status} <> 'cancelled' or ${table.cancellationReason} is not null`,
    ),
  ],
);

// Una serie de citas semanales (R1): se crean todas de golpe, una por cada
// día elegido hasta la fecha de fin. Las citas se guardan como cualquier otra;
// la serie solo recuerda cómo se crearon, para cambiar o cancelar "esta y las
// siguientes" o "todas"
export const appointmentSeries = pgTable(
  "appointment_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // "individual": las mismas personas cada semana · "class": clase de grupo (R3)
    kind: text("kind").notNull().default("individual"),
    // cascade: un servicio o una sala solo se borran si no tienen citas, y
    // entonces su serie tampoco tiene ninguna (no puede frenar el borrado)
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    physioId: text("physio_id").references(() => user.id, { onDelete: "set null" }),
    // Días de la semana: 1 = lunes … 7 = domingo
    weekdays: smallint("weekdays").array().notNull(),
    // "HH:MM", hora local de la clínica
    startTime: text("start_time").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("appointment_series_org_idx").on(table.organizationId),
    check("appointment_series_kind_check", sql`${table.kind} in ('individual', 'class')`),
    check("appointment_series_dates_check", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

// Alumnos inscritos en una clase (serie "class", R3). Inscribirse añade a la
// persona a todas las sesiones futuras de la clase (si hay plaza); darse de
// baja la quita desde ese día. La fila se queda (historial) con su to_date
export const seriesMember = pgTable(
  "series_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => appointmentSeries.id, { onDelete: "cascade" }),
    // Su ficha, o nombre y apellidos (y un email para los recordatorios)
    patientId: uuid("patient_id").references(() => patient.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    contactEmail: text("contact_email"),
    // Desde qué día va a la clase y, si se dio de baja, el último día
    fromDate: date("from_date").notNull(),
    toDate: date("to_date"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("series_member_series_idx").on(table.seriesId)],
);

export const attendanceStatus = pgEnum("attendance_status", [
  "pending", // aún no ha pasado
  "attended", // vino
  "no_show", // no vino
]);

// Una fila por paciente y cita (varias en las sesiones en grupo).
// patientId apunta a la ficha del paciente (patient-schema.ts). Es null cuando
// la cita se da solo con nombre y apellidos, sin ficha, y en las de fichas
// borradas: por eso el nombre y los apellidos se guardan también aquí.
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
    patientId: uuid("patient_id").references(() => patient.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // Solo en los pacientes sin ficha: el email que escribió la clínica al dar
    // la cita, para los recordatorios. Con ficha se usa el de la ficha
    contactEmail: text("contact_email"),
    // Reserva online sin enlazar: una ficha con ese email que podría ser este
    // paciente (el nombre no coincidía, o había varias). Recepción decide
    // desde la cita (Enlazar). set null: si se borra la ficha, desaparece
    suggestedPatientId: uuid("suggested_patient_id").references(() => patient.id, {
      onDelete: "set null",
    }),
    // Plaza reservada online en una clase: su teléfono y la clave de su enlace
    // para ver y cancelar su plaza (las citas individuales la llevan en la cita)
    contactPhone: text("contact_phone"),
    cancelToken: text("cancel_token"),
    attendance: attendanceStatus("attendance").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("appointment_patient_appointment_idx").on(table.appointmentId),
    index("appointment_patient_org_idx").on(table.organizationId),
    // Historial de citas de un paciente
    index("appointment_patient_patient_idx").on(table.patientId),
    index("appointment_patient_cancel_token_idx").on(table.cancelToken),
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
