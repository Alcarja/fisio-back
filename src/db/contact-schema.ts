import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/*
 * Solicitudes de contacto de la web pública (formulario /contacto).
 * Cada una avisa por email (CONTACT_NOTIFY_EMAIL) y queda guardada aquí, por si
 * el email no llega.
 */
export const contactRequest = pgTable(
  "contact_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    clinicName: text("clinic_name").notNull(),
    phone: text("phone"),
    // "solo", "2-5", "6-15", "16+"
    teamSize: text("team_size"),
    message: text("message"),
    // Para marcar las ya respondidas
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("contact_request_created_idx").on(table.createdAt)],
);
