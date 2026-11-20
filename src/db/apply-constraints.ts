import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "./index.js";

// Applies src/db/sql/*.sql constraints and triggers that drizzle-kit push
// can't create.
// Run after `npm run db:push`. Safe to run more than once.
async function applyConstraints() {
  for (const [name, what] of [
    ["appointment-constraints.sql", "appointment_physio_no_overlap"],
    ["professional-log.sql", "member_professional_log (historial de profesionales)"],
  ]) {
    const sql = await readFile(new URL(`./sql/${name}`, import.meta.url), "utf8");
    await pool.query(sql);
    console.log(`Constraints applied: ${what}`);
  }
}

applyConstraints()
  .catch((error) => {
    console.error("Applying constraints failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
