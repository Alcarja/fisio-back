import { featurePrice, plan, planFeature } from "./schema.js";
import { db, pool } from "./index.js";

// Loads Kineflow's starting plans and extra prices (PRICING.md).
//   npm run db:seed-plans
// Only creates what isn't there (by plan name / feature): prices changed in
// the panel (super-admin → Planes) are never overwritten. Safe to repeat.

const euros = (n: number) => Math.round(n * 100);
const tiers = (one: number, three: number, six: number, ten: number) => [
  { upTo: 1, cents: euros(one) },
  { upTo: 3, cents: euros(three) },
  { upTo: 6, cents: euros(six) },
  { upTo: 10, cents: euros(ten) },
];

const PLANS = [
  {
    name: "Esencial",
    description: "La agenda, las clases y la reserva online.",
    position: 1,
    priceTiers: tiers(29, 49, 79, 109),
    extraProfessionalCents: euros(10),
    features: ["online_booking"],
  },
  {
    name: "Clínica",
    description: "Esencial + pacientes e historia clínica, recordatorios y ejercicios para casa.",
    position: 2,
    priceTiers: tiers(49, 79, 119, 159),
    extraProfessionalCents: euros(12),
    features: ["online_booking", "reminders", "clinical_history"],
  },
  {
    name: "Pro",
    description: "Clínica + Cobros y bonos, la web de la clínica y soporte prioritario.",
    position: 3,
    priceTiers: tiers(65, 95, 135, 175),
    extraProfessionalCents: euros(13),
    features: ["online_booking", "reminders", "clinical_history", "invoicing", "website"],
  },
];

// Extras on Esencial and Clínica. The rest start without a price (the panel warns)
const EXTRAS: Record<string, number> = { invoicing: euros(12), website: euros(19) };

async function main() {
  let created = 0;
  for (const { features, ...p } of PLANS) {
    const [row] = await db
      .insert(plan)
      .values({ ...p, annualMonths: 10 })
      .onConflictDoNothing({ target: plan.name })
      .returning({ id: plan.id });
    if (!row) continue;
    await db.insert(planFeature).values(features.map((feature) => ({ planId: row.id, feature })));
    created++;
  }
  for (const [feature, monthlyCents] of Object.entries(EXTRAS)) {
    await db.insert(featurePrice).values({ feature, monthlyCents }).onConflictDoNothing();
  }
  console.log(`Plans: ${created} created (${PLANS.length - created} already there). Extra prices loaded where missing.`);
}

main()
  .catch((error) => {
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    console.error("Loading the plans failed:", cause ?? (error as Error).message?.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
