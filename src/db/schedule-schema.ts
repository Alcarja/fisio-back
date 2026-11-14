import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth-schema.js";

/*
 * 1. Horario de la clínica (CALENDARIO.md)
 *
 * Las horas se guardan como hora local de la clínica ("09:00"), sin zona.
 * La zona horaria está en organization.timezone.
 * Días de la semana ISO: 1 = lunes … 7 = domingo.
 *
 * Relaciones: todo cuelga de organization. Ninguna otra tabla apunta aquí;
 * las citas se validan contra este horario en el backend.
 * Mapa completo: "Modelo de datos" en CALENDARIO.md.
 */

// Franjas semanales: varias por día (mañana y tarde = dos filas del mismo día)
export const clinicOpeningHours = pgTable(
  "clinic_opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("clinic_opening_hours_org_weekday_idx").on(table.organizationId, table.weekday),
    check("clinic_opening_hours_weekday_check", sql`${table.weekday} between 1 and 7`),
    check("clinic_opening_hours_time_check", sql`${table.startTime} < ${table.endTime}`),
  ],
);

// closed: la clínica cierra (festivo, vacaciones)
// special_hours: abre con otras franjas (horario de verano), en clinic_schedule_exception_hours
export const scheduleExceptionType = pgEnum("schedule_exception_type", [
  "closed",
  "special_hours",
]);

// Excepciones por rango de fechas (ambos días incluidos). Un festivo: start = end
export const clinicScheduleException = pgTable(
  "clinic_schedule_exception",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: scheduleExceptionType("type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("clinic_schedule_exception_org_dates_idx").on(
      table.organizationId,
      table.startDate,
      table.endDate,
    ),
    check("clinic_schedule_exception_dates_check", sql`${table.startDate} <= ${table.endDate}`),
  ],
);

// Franjas de una excepción special_hours. weekday null = todos los días del rango
export const clinicScheduleExceptionHours = pgTable(
  "clinic_schedule_exception_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => clinicScheduleException.id, { onDelete: "cascade" }),
    weekday: smallint("weekday"),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("clinic_schedule_exception_hours_exception_idx").on(table.exceptionId),
    check(
      "clinic_schedule_exception_hours_weekday_check",
      sql`${table.weekday} is null or ${table.weekday} between 1 and 7`,
    ),
    check(
      "clinic_schedule_exception_hours_time_check",
      sql`${table.startTime} < ${table.endTime}`,
    ),
  ],
);

export const clinicScheduleExceptionRelations = relations(
  clinicScheduleException,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [clinicScheduleException.organizationId],
      references: [organization.id],
    }),
    hours: many(clinicScheduleExceptionHours),
  }),
);

export const clinicScheduleExceptionHoursRelations = relations(
  clinicScheduleExceptionHours,
  ({ one }) => ({
    exception: one(clinicScheduleException, {
      fields: [clinicScheduleExceptionHours.exceptionId],
      references: [clinicScheduleException.id],
    }),
  }),
);
