import { sql } from "drizzle-orm";
import { parseVideoUrl } from "../lib/exercises.js";
import { BASE_EXERCISE_VIDEOS } from "./base-exercise-videos.js";
import { BASE_EXERCISES } from "./base-exercises.js";
import { db, pool } from "./index.js";
import { exercise } from "./schema.js";

// Loads Kineflow's base exercise bank (base-exercises.ts), or updates it.
//   npm run db:seed-exercises
// Safe to repeat: each exercise is found by its key. Images and clinics' own
// exercises (and their copies of base ones) aren't touched.

async function main() {
  // Every video belongs to an exercise of the bank, and is a valid YouTube link
  const keys = new Set(BASE_EXERCISES.map((e) => e.key));
  for (const [key, url] of Object.entries(BASE_EXERCISE_VIDEOS)) {
    if (!keys.has(key)) throw new Error(`base-exercise-videos.ts: "${key}" isn't an exercise of the bank`);
    const parsed = parseVideoUrl(url);
    if (typeof parsed === "string" || parsed.url !== url) throw new Error(`base-exercise-videos.ts: "${key}" has a bad link`);
  }
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
      videoUrl: BASE_EXERCISE_VIDEOS[e.key] ?? null,
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
    // Drizzle's message is the query; the database's reason is in `cause`
    // (e.g. a column that isn't there yet: run `npm run db:push` first)
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    console.error("Loading the exercises failed:", cause ?? (error as Error).message?.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
