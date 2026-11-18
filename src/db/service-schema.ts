import { relations, sql } from "drizzle-orm";
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
import { organization } from "./auth-schema.js";
import { roomType } from "./room-schema.js";

/*
 * 3. Servicios o tratamientos (CALENDARIO.md)
 *
 * Relaciones: cuelga de organization y apunta a room_type (room-schema.ts).
 * Apunta aquí: appointment.serviceId (restrict: un servicio con citas no se borra).
 * Mapa completo: "Modelo de datos" en CALENDARIO.md.
 */

export const service = pgTable(
  "service",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    // Limpieza o preparación de la sala después de cada cita
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    // En céntimos para evitar errores de redondeo (45,50 € = 4550)
    priceCents: integer("price_cents").notNull().default(0),
    // Tipo de sala que necesita. null = cualquier sala
    roomTypeId: uuid("room_type_id").references(() => roomType.id, { onDelete: "set null" }),
    // Individual: isGroup = false y maxPatients = 1
    isGroup: boolean("is_group").notNull().default(false),
    maxPatients: integer("max_patients").notNull().default(1),
    // Color en el calendario, "#RRGGBB"
    color: text("color").notNull().default("#5B8DEF"),
    // Los servicios no se borran si tienen citas: se desactivan
    isActive: boolean("is_active").notNull().default(true),
    // En la web de la clínica (WEBS.md): descripción pública y si aparece
    publicDescription: text("public_description"),
    showOnWeb: boolean("show_on_web").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("service_org_idx").on(table.organizationId),
    unique("service_org_name_unique").on(table.organizationId, table.name),
    check("service_duration_check", sql`${table.durationMinutes} > 0`),
    check("service_buffer_check", sql`${table.bufferMinutes} >= 0`),
    check("service_price_check", sql`${table.priceCents} >= 0`),
    check(
      "service_max_patients_check",
      sql`${table.maxPatients} >= 1 and (${table.isGroup} or ${table.maxPatients} = 1)`,
    ),
    check("service_color_check", sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

export const serviceRelations = relations(service, ({ one }) => ({
  organization: one(organization, {
    fields: [service.organizationId],
    references: [organization.id],
  }),
  roomType: one(roomType, { fields: [service.roomTypeId], references: [roomType.id] }),
}));
