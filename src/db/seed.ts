import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { db, pool } from "./index.js";
import { user } from "./schema.js";

// Creates the first super-admin from .env. Safe to run more than once.
//
//   npm run db:seed                       create it (an existing one keeps its password)
//   npm run db:seed -- --reset-password   also set SUPERADMIN_PASSWORD on an existing one
//
// --reset-password is how a super-admin gets back in: "forgot password" never
// emails them a link (auth.ts → sendResetPassword), so only someone with access
// to the server and its .env can change it. It also logs them out everywhere.
// Tip: once it's done, remove SUPERADMIN_PASSWORD from the server's .env.
const resetPassword = process.argv.includes("--reset-password");

// Same minimum as Better Auth (auth.ts → emailAndPassword.minPasswordLength)
const MIN_PASSWORD_LENGTH = 10;

async function seedSuperAdmin() {
  const name = process.env.SUPERADMIN_NAME;
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("Set SUPERADMIN_NAME, SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SUPERADMIN_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const [existing] = await db.select().from(user).where(eq(user.email, email));

  if (!existing) {
    // Goes through Better Auth so the password is hashed and the account row is created
    await auth.api.signUpEmail({ body: { name, email, password } });
    console.log(`Created user ${email}`);
  } else if (resetPassword) {
    await setPassword(existing.id, password);
    console.log(`Password of ${email} changed, and all its sessions closed`);
  } else {
    console.log(
      `User ${email} already exists, leaving the password unchanged (use --reset-password to change it)`,
    );
  }

  await db
    .update(user)
    .set({ role: "superadmin", emailVerified: true })
    .where(eq(user.email, email));

  console.log(`${email} is a super-admin`);
}

// Hashed the same way Better Auth does at sign-up. Users without a password
// (e.g. Google only) get one; every session is closed, like after a reset
async function setPassword(userId: string, password: string) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  if (await ctx.internalAdapter.findCredentialAccount(userId)) {
    await ctx.internalAdapter.updatePassword(userId, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId,
      accountId: userId,
      providerId: "credential",
      password: hash,
    });
  }
  await ctx.internalAdapter.deleteUserSessions(userId);
}

seedSuperAdmin()
  .catch((error) => {
    console.error("Seed failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
