import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { db, pool } from "./index.js";
import { organization, user } from "./schema.js";

// Creates a test clinic with its own owner user. Safe to run more than once.
const OWNER = {
  name: process.env.TEST_OWNER_NAME ?? "Test Owner",
  email: (process.env.TEST_OWNER_EMAIL ?? "owner@fisio.test").toLowerCase(),
  password: process.env.TEST_OWNER_PASSWORD ?? "TestOwner123!",
};

const CLINIC = {
  name: process.env.TEST_CLINIC_NAME ?? "Clínica Test",
  slug: process.env.TEST_CLINIC_SLUG ?? "clinica-test",
};

async function seedTestClinic() {
  // 1. Owner user
  let [owner] = await db.select().from(user).where(eq(user.email, OWNER.email));

  if (!owner) {
    await auth.api.signUpEmail({ body: OWNER });
    [owner] = await db.select().from(user).where(eq(user.email, OWNER.email));
    console.log(`Created owner ${OWNER.email} (password: ${OWNER.password})`);
  } else {
    console.log(`Owner ${OWNER.email} already exists`);
  }

  await db.update(user).set({ emailVerified: true }).where(eq(user.id, owner!.id));

  // 2. Clinic
  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, CLINIC.slug));

  if (existing) {
    console.log(`Clinic "${existing.name}" (${existing.slug}) already exists: ${existing.id}`);
    return;
  }

  // No headers + userId = server-side "system action": skips the super-admin-only
  // check and makes this user the owner (not whoever is logged in).
  const clinic = await auth.api.createOrganization({
    body: { name: CLINIC.name, slug: CLINIC.slug, userId: owner!.id },
  });

  console.log(`Created clinic "${clinic?.name}" (${clinic?.slug}): ${clinic?.id}`);
}

seedTestClinic()
  .catch((error) => {
    console.error("Seed failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
