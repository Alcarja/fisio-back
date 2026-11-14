import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { db, pool } from "./index.js";
import { user } from "./schema.js";

// Creates the first super-admin from .env. Safe to run more than once.
async function seedSuperAdmin() {
  const name = process.env.SUPERADMIN_NAME;
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("Set SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env");
  }

  const [existing] = await db.select().from(user).where(eq(user.email, email));

  if (!existing) {
    // Goes through Better Auth so the password is hashed and the account row is created
    await auth.api.signUpEmail({ body: { name, email, password } });
    console.log(`Created user ${email}`);
  } else {
    console.log(`User ${email} already exists, leaving the password unchanged`);
  }

  await db
    .update(user)
    .set({ role: "superadmin", emailVerified: true })
    .where(eq(user.email, email));

  console.log(`${email} is a super-admin`);
}

seedSuperAdmin()
  .catch((error) => {
    console.error("Seed failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
