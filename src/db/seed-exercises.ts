import { sql } from "drizzle-orm";
import { BASE_EXERCISES } from "./base-exercises.js";
import { db, pool } from "./index.js";
import { exercise } from "./schema.js";

// Loads Kineflow's base exercise bank (base-exercises.ts), or updates it.
//   npm run db:seed-exercises
// Safe to repeat: each exercise is found by its key. Images and clinics' own
// exercises (and their copies of base ones) aren't touched.

async function main() {
  let count = 0;
  for (const e of BASE_EXERCISES) {
    const values = {
      baseKey: e.key,
      organizationId: null,
      name: e.name,
      bodyRegions: e.bodyRegions,
      type: e.type,
      equipment: e.equipment,
      instructions: e.instructions,
      precautions: e.precautions ?? null,
      defaultSets: e.sets ?? null,
      defaultReps: e.reps ?? null,
      defaultSeconds: e.seconds ?? null,
      defaultRestSeconds: e.rest ?? null,
      perSide: e.perSide ?? false,
    };
    const { baseKey: _k, organizationId: _o, ...update } = values;
    await db
      .insert(exercise)
      .values(values)
      .onConflictDoUpdate({ target: exercise.baseKey, set: { ...update, updatedAt: sql`now()` } });
    count++;
  }
  console.log(`Base exercise bank: ${count} exercises loaded or updated`);
}

main()
  .catch((error) => {
    console.error("Loading the exercises failed:", (error as Error).message?.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
