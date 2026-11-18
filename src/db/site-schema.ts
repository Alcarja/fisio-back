import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { SiteContent } from "../lib/site.js";
import { member, organization, user } from "./auth-schema.js";

/*
 * Web de cada clínica (WEBS.md): what the clinic edits in Admin → Mi web and
 * what the sites service shows on <subdomain>.sites.kineflow.es or its own domain.
 *
 * - clinic_site: one row per clinic that has opened Mi web. `draft` is what
 *   the clinic is editing; `published` is what visitors see (copied from the
 *   draft on "Publicar"). Both have the shape SiteContent (lib/site.ts), the
 *   same for every template.
 * - clinic_site_domain: own domains (Phase 4).
 * - clinic_site_image: logo, cover, gallery and team photos.
 * - member_public_profile: what a professional shows on the website. Changes
 *   here are live at once (not part of the draft).
 *
 * Only public content: none of these tables hold health data, so none are
 * encrypted. NEVER add patient data to them: the sites service reads them
 * with a database user that can see nothing else.
 */

// Binary content (Drizzle has no bytea type)
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const clinicSite = pgTable(
  "clinic_site",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    // activapilates → activapilates.sites.kineflow.es. Unique, lowercase, a-z0-9-
    subdomain: text("subdomain").notNull().unique(),
    // Key from lib/siteTemplates.ts
    template: text("template").notNull(),
    // A custom design only this clinic can use (super-admin sets it). Null = none
    customTemplate: text("custom_template"),
    draft: jsonb("draft").$type<SiteContent>().notNull(),
    published: jsonb("published").$type<SiteContent>(),
    publishedTemplate: text("published_template"),
    status: text("status").notNull().default("draft"), // draft | published | offline
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Show "Reservas con Kineflow" in the footer (cheaper plans)
    showKineflowCredit: boolean("show_kineflow_credit").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check("clinic_site_status_check", sql`${t.status} in ('draft','published','offline')`),
    check(
      "clinic_site_subdomain_check",
      sql`${t.subdomain} ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'`,
    ),
  ],
);

// Own domains. Two rows per domain the clinic connects: activapilates.es and www.activapilates.es
export const clinicSiteDomain = pgTable(
  "clinic_site_domain",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull().unique(), // lowercase, ASCII (punycode)
    isPrimary: boolean("is_primary").notNull().default(false),
    // The value of the TXT record _kineflow.<domain> = kf-<token>. Same for both rows of a domain
    verifyToken: text("verify_token").notNull(),
    status: text("status").notNull().default("pending"), // pending | verified | error
    lastError: text("last_error"), // e.g. "A_RECORD_MISSING", "TXT_MISSING"
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clinic_site_domain_org_idx").on(t.organizationId),
    check("clinic_site_domain_status_check", sql`${t.status} in ('pending','verified','error')`),
  ],
);

// Logo, cover, gallery and team photos. Compressed in the browser, like the exercise images
export const clinicSiteImage = pgTable(
  "clinic_site_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // logo | cover | gallery | team
    mimeType: text("mime_type").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("clinic_site_image_org_idx").on(t.organizationId),
    check("clinic_site_image_kind_check", sql`${t.kind} in ('logo','cover','gallery','team')`),
  ],
);

// What a professional shows on the website. One row per member who has been
// set up in Mi web → Equipo (no row = not shown)
export const memberPublicProfile = pgTable(
  "member_public_profile",
  {
    memberId: text("member_id")
      .primaryKey()
      .references(() => member.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    visible: boolean("visible").notNull().default(true),
    displayName: text("display_name"), // null = the user's name
    headline: text("headline"), // "Fisioterapeuta · Suelo pélvico"
    bio: text("bio"),
    // Nº de colegiado: often required in health advertising
    licenseNumber: text("license_number"),
    photoId: uuid("photo_id").references(() => clinicSiteImage.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("member_public_profile_org_idx").on(t.organizationId)],
);
