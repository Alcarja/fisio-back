import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "./index.js";

// Applies src/db/sql/*.sql constraints that drizzle-kit push can't create.
// Run after `npm run db:push`. Safe to run more than once.
async function applyConstraints() {
  const file = new URL("./sql/appointment-constraints.sql", import.meta.url);
  const sql = await readFile(file, "utf8");
  await pool.query(sql);
  console.log("Constraints applied: appointment_physio_no_overlap");
}

applyConstraints()
  .catch((error) => {
    console.error("Applying constraints failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
