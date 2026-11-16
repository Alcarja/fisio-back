import { sql } from "drizzle-orm";
import { encrypt, isEncrypted } from "../lib/encryption.js";
import { db, pool } from "./index.js";

// Encrypts the clinical texts saved before encryption existed
// (src/lib/encryption.ts). Run once after setting DATA_ENCRYPTION_KEY:
//   npm run db:encrypt-clinical
// Safe to repeat: values already encrypted are left alone. All or nothing.
// Written in plain SQL so the values are read and saved exactly as stored
// (through the schema they would come back already decrypted).

const COLUMNS = {
  patient: ["notes", "clinical_alert", "allergies", "medication", "medical_history", "occupation"],
  patient_case: ["title", "reason", "diagnosis", "plan", "close_notes"],
  case_note: ["text"],
} as const;

async function main() {
  await db.transaction(async (tx) => {
    for (const [table, columns] of Object.entries(COLUMNS)) {
      let changed = 0;
      for (const column of columns) {
        const { rows } = await tx.execute<{ id: string; value: string }>(
          sql`select id, ${sql.identifier(column)} as value from ${sql.identifier(table)}
              where ${sql.identifier(column)} is not null for update`,
        );
        for (const row of rows) {
          if (isEncrypted(row.value)) continue;
          await tx.execute(
            sql`update ${sql.identifier(table)} set ${sql.identifier(column)} = ${encrypt(row.value)}
                where id = ${row.id}`,
          );
          changed++;
        }
      }
      console.log(`${table}: ${changed} values encrypted`);
    }
  });
}

main()
  .catch((error) => {
    // Only the message: the error could carry the values
    console.error("Encrypting failed, nothing was changed:", (error as Error).message?.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
