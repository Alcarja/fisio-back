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
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth-schema.js";

/*
 * 2. Salas (CALENDARIO.md)
 *
 * Relaciones: todo cuelga de organization.
 * Apuntan aquí desde otros archivos:
 *   service.roomTypeId     → room_type  (tipo de sala que necesita el servicio)
 *   appointment.roomId     → room       (restrict: una sala con citas no se borra)
 * Sin filas en room_opening_hours, la sala sigue el horario de la clínica.
 * Mapa completo: "Modelo de datos" en CALENDARIO.md.
 */

// Tipos de sala de cada clínica (camilla, gimnasio, piscina…).
// Una tabla y no texto libre para que el servicio pueda exigir un tipo concreto
export const roomType = pgTable(
  "room_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("room_type_org_name_unique").on(table.organizationId, table.name)],
);

export const room = pgTable(
  "room",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Personas a la vez: 1 = sesiones individuales, más = grupos
    capacity: integer("capacity").notNull().default(1),
    roomTypeId: uuid("room_type_id").references(() => roomType.id, { onDelete: "set null" }),
    // Equipamiento u otros detalles en texto libre
    description: text("description"),
    // Las salas no se borran si tienen citas: se desactivan
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("room_org_idx").on(table.organizationId),
    unique("room_org_name_unique").on(table.organizationId, table.name),
    check("room_capacity_check", sql`${table.capacity} > 0`),
  ],
);

// Horario propio opcional. Sala sin filas aquí = sigue el horario de la clínica.
// Con filas = solo abre en esas franjas (y siempre dentro del horario de la clínica)
export const roomOpeningHours = pgTable(
  "room_opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("room_opening_hours_room_weekday_idx").on(table.roomId, table.weekday),
    check("room_opening_hours_weekday_check", sql`${table.weekday} between 1 and 7`),
    check("room_opening_hours_time_check", sql`${table.startTime} < ${table.endTime}`),
  ],
);

// Bloqueos puntuales (mantenimiento), en UTC
export const roomBlock = pgTable(
  "room_block",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("room_block_room_range_idx").on(table.roomId, table.startsAt, table.endsAt),
    check("room_block_range_check", sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

export const roomTypeRelations = relations(roomType, ({ many }) => ({
  rooms: many(room),
}));

export const roomRelations = relations(room, ({ one, many }) => ({
  organization: one(organization, {
    fields: [room.organizationId],
    references: [organization.id],
  }),
  type: one(roomType, { fields: [room.roomTypeId], references: [roomType.id] }),
  openingHours: many(roomOpeningHours),
  blocks: many(roomBlock),
}));

export const roomOpeningHoursRelations = relations(roomOpeningHours, ({ one }) => ({
  room: one(room, { fields: [roomOpeningHours.roomId], references: [room.id] }),
}));

export const roomBlockRelations = relations(roomBlock, ({ one }) => ({
  room: one(room, { fields: [roomBlock.roomId], references: [room.id] }),
}));
