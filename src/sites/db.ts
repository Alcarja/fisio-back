import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { member, organization, user } from "../db/auth-schema.js";
import { clinicLegal } from "../db/clinic-legal-schema.js";
import { clinicFeature } from "../db/feature-schema.js";
import { clinicOnlineBooking } from "../db/online-booking-schema.js";
import { clinicOpeningHours } from "../db/schedule-schema.js";
import { service } from "../db/service-schema.js";
import {
  clinicSite,
  clinicSiteDomain,
  clinicSiteImage,
  memberPublicProfile,
} from "../db/site-schema.js";
import { env } from "./env.js";

// The sites service's own connection, with the read-only database user
// (kineflow_sites, WEBS.md 3.2). That user can only read some columns of some
// tables: ALWAYS select explicit columns (a plain select() asks for all of
// them and fails with "permission denied").
//
// Never import db/index.ts here: it loads the API's .env and connects with
// the main user (npm run check:sites stops it).

export const pool = new Pool({ connectionString: env.databaseUrl, max: 5 });

export const db = drizzle(pool);

export {
  clinicFeature,
  clinicLegal,
  clinicOnlineBooking,
  clinicOpeningHours,
  clinicSite,
  clinicSiteDomain,
  clinicSiteImage,
  member,
  memberPublicProfile,
  organization,
  service,
  user,
};
