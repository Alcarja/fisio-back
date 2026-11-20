import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  clinicAddon,
  clinicBilling,
  clinicDocument,
  clinicFeature,
  clinicProfessionalLog,
  featurePrice,
  invitation,
  member,
  plan,
  planFeature,
  type PriceTier,
} from "../db/schema.js";
import { zonedToUtc } from "./timezone.js";
import { PROFESSIONAL_ROLES } from "./appointments.js";
import { CLINIC_FEATURES, isClinicFeature, type ClinicFeature } from "./features.js";

// Plans, prices and what each clinic has contracted (super-admin → Planes and
// a clinic → Plan y precio). Data in db/plan-schema.ts and clinic_billing.
//
// Contracted ≠ active: what a clinic has contracted comes from its plan plus
// its extras; what's active is what's switched on (clinic_feature). They can
// differ on purpose (a free trial, the historia clínica waiting for signed
// documents), so the panel shows both and warns about the differences.
//
// All prices are monthly and before IVA. Annual payment = the month's price ×
// the plan's annualMonths (10 = two months free), extras included.

export type Cycle = "monthly" | "annual";

export type PlanRow = typeof plan.$inferSelect & { features: ClinicFeature[] };

// ---------- Validating what the panel sends ----------

const MAX_CENTS = 10_000_000; // 100.000 €
const isCents = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_CENTS;

export type PlanInput = {
  name: string;
  description: string | null;
  position: number;
  priceTiers: PriceTier[];
  extraProfessionalCents: number;
  annualMonths: number;
  features: ClinicFeature[];
  archived: boolean;
};

// The whole plan, checked. A string = what's wrong
export function parsePlan(body: Record<string, unknown>): PlanInput | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) return "El plan necesita un nombre (máximo 60 caracteres)";
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (description && description.length > 300) return "La descripción admite 300 caracteres";
  const tiers = body.priceTiers;
  if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > 10) return "Indica entre 1 y 10 tramos de precio";
  let last = 0;
  for (const t of tiers as Record<string, unknown>[]) {
    if (!Number.isInteger(t?.upTo) || (t.upTo as number) <= last || (t.upTo as number) > 1000) {
      return "Los tramos van por número de profesionales, de menos a más";
    }
    if (!isCents(t.cents)) return "Algún precio de tramo no es válido";
    last = t.upTo as number;
  }
  if (!isCents(body.extraProfessionalCents ?? 0)) return "El precio por profesional extra no es válido";
  const annualMonths = body.annualMonths ?? 12;
  if (!Number.isInteger(annualMonths) || (annualMonths as number) < 1 || (annualMonths as number) > 12) {
    return "En el pago anual se cobran entre 1 y 12 meses";
  }
  const features = body.features ?? [];
  if (!Array.isArray(features) || !features.every(isClinicFeature)) return "Alguna funcionalidad no es válida";
  const position = body.position ?? 0;
  if (!Number.isInteger(position)) return "El orden no es válido";
  return {
    name,
    description,
    position: position as number,
    priceTiers: (tiers as PriceTier[]).map((t) => ({ upTo: t.upTo, cents: t.cents })),
    extraProfessionalCents: (body.extraProfessionalCents as number | undefined) ?? 0,
    annualMonths: annualMonths as number,
    features: [...new Set(features as ClinicFeature[])],
    archived: body.archived === true,
  };
}

export type ContractInput = {
  planId: string | null;
  cycle: Cycle;
  professionalsOverride: number | null;
  discountPercent: number;
  discountNote: string | null;
  priceOverrideCents: number | null;
  notes: string | null;
  addons: { feature: ClinicFeature; priceCents: number | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalText = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parseContract(body: Record<string, unknown>): ContractInput | string {
  const planId = body.planId ?? null;
  if (planId !== null && (typeof planId !== "string" || !UUID.test(planId))) return "El plan no es válido";
  if (body.cycle !== "monthly" && body.cycle !== "annual") return "Elige pago mensual o anual";
  const override = body.professionalsOverride ?? null;
  if (override !== null && (!Number.isInteger(override) || (override as number) < 1 || (override as number) > 1000)) {
    return "El número de profesionales no es válido";
  }
  const discount = body.discountPercent ?? 0;
  if (!Number.isInteger(discount) || (discount as number) < 0 || (discount as number) > 100) {
    return "El descuento va de 0 a 100 %";
  }
  const priceOverride = body.priceOverrideCents ?? null;
  if (priceOverride !== null && !isCents(priceOverride)) return "El precio pactado no es válido";
  const addons = body.addons ?? [];
  if (!Array.isArray(addons)) return "Los extras no son válidos";
  const seen = new Set<string>();
  for (const a of addons as Record<string, unknown>[]) {
    if (!isClinicFeature(a?.feature) || seen.has(a.feature)) return "Algún extra no es válido";
    if (a.priceCents !== null && a.priceCents !== undefined && !isCents(a.priceCents)) return "El precio de algún extra no es válido";
    seen.add(a.feature);
  }
  return {
    planId: planId as string | null,
    cycle: body.cycle,
    professionalsOverride: override as number | null,
    discountPercent: discount as number,
    discountNote: optionalText(body.discountNote, 200),
    priceOverrideCents: priceOverride as number | null,
    notes: optionalText(body.notes, 1000),
    addons: (addons as { feature: ClinicFeature; priceCents?: number | null }[]).map((a) => ({
      feature: a.feature,
      priceCents: a.priceCents ?? null,
    })),
  };
}

// ---------- Prices ----------

// The plan's price for a month with this many professionals
export function tierPrice(p: Pick<PlanRow, "priceTiers" | "extraProfessionalCents">, professionals: number) {
  const tiers = [...p.priceTiers].sort((a, b) => a.upTo - b.upTo);
  const tier = tiers.find((t) => professionals <= t.upTo);
  if (tier) return tier.cents;
  const top = tiers[tiers.length - 1]!;
  return top.cents + (professionals - top.upTo) * p.extraProfessionalCents;
}

export type Quote = {
  planCents: number; // a month of the plan (its tier, or the agreed price)
  planFromOverride: boolean;
  addons: { feature: ClinicFeature; cents: number; custom: boolean; missingPrice: boolean }[];
  subtotalCents: number; // plan + extras, a month
  discountCents: number; // a month
  monthlyCents: number; // what it's worth a month (also for annual: the monthly equivalent)
  cycle: Cycle;
  annualMonths: number;
  periodCents: number; // what each payment is: a month, or the year
};

export function quote(input: {
  plan: PlanRow | null;
  cycle: Cycle;
  professionals: number;
  discountPercent: number;
  priceOverrideCents: number | null;
  addons: { feature: ClinicFeature; priceCents: number | null }[];
  prices: Map<string, number | null>;
}): Quote {
  const planCents = input.priceOverrideCents ?? (input.plan ? tierPrice(input.plan, input.professionals) : 0);
  // Extras the plan already includes cost nothing more
  const addons = input.addons
    .filter((a) => !input.plan?.features.includes(a.feature))
    .map((a) => {
      const listed = input.prices.get(a.feature) ?? null;
      return {
        feature: a.feature,
        cents: a.priceCents ?? listed ?? 0,
        custom: a.priceCents !== null,
        missingPrice: a.priceCents === null && listed === null,
      };
    });
  const subtotalCents = planCents + addons.reduce((n, a) => n + a.cents, 0);
  const discountCents = Math.round((subtotalCents * input.discountPercent) / 100);
  const monthlyCents = subtotalCents - discountCents;
  const annualMonths = input.plan?.annualMonths ?? 12;
  // The monthly equivalent of an annual payment: the year ÷ 12
  const periodCents = input.cycle === "annual" ? monthlyCents * annualMonths : monthlyCents;
  return {
    planCents,
    planFromOverride: input.priceOverrideCents !== null,
    addons,
    subtotalCents,
    discountCents,
    monthlyCents: input.cycle === "annual" ? Math.round(periodCents / 12) : monthlyCents,
    cycle: input.cycle,
    annualMonths,
    periodCents,
  };
}

// ---------- Loading ----------

export async function loadPlans(): Promise<PlanRow[]> {
  const [plans, features] = await Promise.all([
    db.select().from(plan).orderBy(plan.position, plan.name),
    db.select().from(planFeature),
  ]);
  return plans.map((p) => ({
    ...p,
    features: features.filter((f) => f.planId === p.id).map((f) => f.feature).filter(isClinicFeature),
  }));
}

export async function loadFeaturePrices() {
  const rows = await db.select().from(featurePrice);
  return new Map<string, number | null>(rows.map((r) => [r.feature, r.monthlyCents]));
}

// Professionals of each clinic: members who are owner, admin or physio
// (a member may have several roles, "admin,physio"). Reception doesn't count
export async function countProfessionals(clinicIds: string[]) {
  if (clinicIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ clinicId: member.organizationId, n: sql<number>`count(*)::int` })
    .from(member)
    .where(
      and(
        inArray(member.organizationId, clinicIds),
        sql`string_to_array(${member.role}, ',') && ${sql.raw(`array[${PROFESSIONAL_ROLES.map((r) => `'${r}'`).join(",")}]::text[]`)}`,
      ),
    )
    .groupBy(member.organizationId);
  return new Map(rows.map((r) => [r.clinicId, r.n]));
}

// Has the clinic the documents the historia clínica needs (DPA and health annex)?
export async function clinicalDocumentsReady(clinicId: string) {
  const rows = await db
    .select({ type: clinicDocument.type })
    .from(clinicDocument)
    .where(and(eq(clinicDocument.organizationId, clinicId), inArray(clinicDocument.type, ["dpa", "health_annex"])));
  const types = new Set(rows.map((r) => r.type));
  return types.has("dpa") && types.has("health_annex");
}

export type Contract = {
  clinicId: string;
  plan: { id: string; name: string; archived: boolean } | null;
  cycle: Cycle;
  exempt: boolean;
  professionalsCounted: number;
  professionalsOverride: number | null;
  professionals: number;
  discountPercent: number;
  discountNote: string | null;
  priceOverrideCents: number | null;
  notes: string | null;
  addons: { feature: ClinicFeature; priceCents: number | null }[];
  // Each feature: contracted (in the plan, as an extra, or not) and active
  features: { feature: ClinicFeature; contracted: "plan" | "addon" | null; active: boolean }[];
  quote: Quote;
};

// The contract of each clinic, with its price and contracted / active features
export async function loadContracts(clinicIds: string[]): Promise<Map<string, Contract>> {
  const out = new Map<string, Contract>();
  if (clinicIds.length === 0) return out;
  const [plans, prices, counts, billing, addons, active] = await Promise.all([
    loadPlans(),
    loadFeaturePrices(),
    countProfessionals(clinicIds),
    db.select().from(clinicBilling).where(inArray(clinicBilling.organizationId, clinicIds)),
    db.select().from(clinicAddon).where(inArray(clinicAddon.organizationId, clinicIds)),
    db.select().from(clinicFeature).where(inArray(clinicFeature.organizationId, clinicIds)),
  ]);
  for (const clinicId of clinicIds) {
    const b = billing.find((x) => x.organizationId === clinicId);
    const p = b?.planId ? (plans.find((x) => x.id === b.planId) ?? null) : null;
    const own = addons
      .filter((a) => a.organizationId === clinicId && isClinicFeature(a.feature))
      .map((a) => ({ feature: a.feature as ClinicFeature, priceCents: a.priceCents }));
    const on = new Set(active.filter((a) => a.organizationId === clinicId).map((a) => a.feature));
    const counted = counts.get(clinicId) ?? 0;
    const professionals = b?.professionalsOverride ?? Math.max(counted, 1);
    const cycle = (b?.cycle as Cycle | undefined) ?? "monthly";
    out.set(clinicId, {
      clinicId,
      plan: p ? { id: p.id, name: p.name, archived: p.archived } : null,
      cycle,
      exempt: b?.exempt ?? false,
      professionalsCounted: counted,
      professionalsOverride: b?.professionalsOverride ?? null,
      professionals,
      discountPercent: b?.discountPercent ?? 0,
      discountNote: b?.discountNote ?? null,
      priceOverrideCents: b?.priceOverrideCents ?? null,
      notes: b?.notes ?? null,
      addons: own,
      features: CLINIC_FEATURES.map((feature) => ({
        feature,
        contracted: p?.features.includes(feature) ? "plan" : own.some((a) => a.feature === feature) ? "addon" : null,
        active: on.has(feature),
      })),
      quote: quote({
        plan: p,
        cycle,
        professionals,
        discountPercent: b?.discountPercent ?? 0,
        priceOverrideCents: b?.priceOverrideCents ?? null,
        addons: own,
        prices,
      }),
    });
    tierInputs.set(clinicId, {
      plan: p,
      cycle,
      discountPercent: b?.discountPercent ?? 0,
      priceOverrideCents: b?.priceOverrideCents ?? null,
      addons: own,
      prices,
    });
    pricers.set(clinicId, (n: number) =>
      quote({
        plan: p,
        cycle,
        // Fixed by hand: always that many, whoever they have
        professionals: b?.professionalsOverride ?? Math.max(n, 1),
        discountPercent: b?.discountPercent ?? 0,
        priceOverrideCents: b?.priceOverrideCents ?? null,
        addons: own,
        prices,
      }),
    );
  }
  return out;
}

// The price of each loaded contract with any number of professionals (the
// month's count, a member about to be added…). Filled by loadContracts
const pricers = new Map<string, (professionals: number) => Quote>();
export const pricerFor = (clinicId: string) => pricers.get(clinicId) ?? null;

// ---------- Professionals over time (clinic_professional_log) ----------

const PLATFORM_TIME_ZONE = "Europe/Madrid";
export const monthStart = (month: string) => zonedToUtc(`${month}-01`, "00:00", PLATFORM_TIME_ZONE);

type LogRow = typeof clinicProfessionalLog.$inferSelect;

export async function loadProfessionalLog(clinicIds: string[]) {
  if (clinicIds.length === 0) return new Map<string, LogRow[]>();
  const rows = await db
    .select()
    .from(clinicProfessionalLog)
    .where(inArray(clinicProfessionalLog.organizationId, clinicIds))
    .orderBy(clinicProfessionalLog.changedAt);
  const out = new Map<string, LogRow[]>();
  for (const r of rows) out.set(r.organizationId, [...(out.get(r.organizationId) ?? []), r]);
  return out;
}

// How many professionals the clinic had at the start of `month`: the last
// change before that day; before the first change, what it had before it;
// with no changes at all, what it has now. A change in the middle of a month
// counts from the next one
export function professionalsAt(log: LogRow[] | undefined, month: string, current: number) {
  const start = monthStart(month);
  const rows = log ?? [];
  const before = rows.filter((r) => r.changedAt < start);
  if (before.length) return before[before.length - 1]!.newCount;
  if (rows.length) return rows[0]!.previousCount;
  return current;
}

// ---------- What a new professional would do to the price ----------

export type PriceImpact = {
  changes: boolean;
  increase: boolean;
  planName: string | null;
  cycle: Cycle;
  fromProfessionals: number;
  toProfessionals: number;
  fromCents: number; // each payment (month or year)
  toCents: number;
  // From when the new price counts: the month after the change
  fromMonth: string;
};

// The clinic's professionals plus the invitations still pending for a
// professional role (once accepted, they count): so a second invitation sent
// before the first is accepted is warned about too
async function professionalsWithPending(clinicId: string) {
  const counted = (await countProfessionals([clinicId])).get(clinicId) ?? 0;
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, clinicId),
        eq(invitation.status, "pending"),
        sql`${invitation.expiresAt} > now()`,
        sql`kineflow_is_professional(${invitation.role})`,
        // Someone who already joined (another way) isn't counted twice
        sql`not exists (select 1 from member m join "user" u on u.id = m.user_id
              where m.organization_id = ${invitation.organizationId} and lower(u.email) = lower(${invitation.email}))`,
      ),
    );
  return counted + (pending?.n ?? 0);
}

// `delta` professionals more (or fewer). null when the price can't change:
// no plan, doesn't pay, or the professionals are fixed by hand
export async function priceImpact(clinicId: string, delta: number, nextMonth: string): Promise<PriceImpact | null> {
  if (delta === 0) return null;
  const contract = (await loadContracts([clinicId])).get(clinicId);
  const pricer = pricerFor(clinicId);
  if (!contract?.plan || contract.exempt || contract.professionalsOverride !== null || !pricer) return null;
  const now = await professionalsWithPending(clinicId);
  const after = Math.max(now + delta, 0);
  const fromCents = pricer(now).periodCents;
  const toCents = pricer(after).periodCents;
  return {
    changes: fromCents !== toCents,
    increase: toCents > fromCents,
    planName: contract.plan.name,
    cycle: contract.cycle,
    fromProfessionals: now,
    toProfessionals: after,
    fromCents,
    toCents,
    fromMonth: nextMonth,
  };
}

// ---------- Alerts for the super-admin ----------

export type ProfessionalChange = {
  id: string;
  changedAt: Date;
  previousCount: number;
  newCount: number;
  // The price changed with it (under the current contract)
  tierChanged: boolean;
  fromCents: number | null;
  toCents: number | null;
  reviewed: boolean;
};

// Each clinic's changes in professionals, newest first, and what needs a look:
// tier changes not reviewed yet, and professionals fixed by hand below what
// the clinic really has ("tiene 5, paga por 3")
export async function professionalAlerts(clinicIds: string[]) {
  const [contracts, logs] = await Promise.all([loadContracts(clinicIds), loadProfessionalLog(clinicIds)]);
  const out = new Map<string, { changes: ProfessionalChange[]; unreviewed: number; overrideBelow: boolean }>();
  for (const id of clinicIds) {
    const c = contracts.get(id)!;
    const pricer = pricerFor(id);
    // With professionals fixed by hand the price doesn't move: price as if counted
    const priced = c.plan && !c.exempt && pricer;
    const changes = [...(logs.get(id) ?? [])].reverse().map((r) => {
      const fromCents = priced ? quoteCounted(id, r.previousCount) : null;
      const toCents = priced ? quoteCounted(id, r.newCount) : null;
      return {
        id: r.id,
        changedAt: r.changedAt,
        previousCount: r.previousCount,
        newCount: r.newCount,
        tierChanged: fromCents !== null && fromCents !== toCents,
        fromCents,
        toCents,
        reviewed: !!r.reviewedAt,
      };
    });
    out.set(id, {
      changes,
      unreviewed: changes.filter((ch) => ch.tierChanged && !ch.reviewed).length,
      overrideBelow: c.professionalsOverride !== null && c.professionalsCounted > c.professionalsOverride,
    });
  }
  return out;
}

// The price with `n` professionals ignoring a hand-fixed number (to tell
// whether a change would have moved the tier)
function quoteCounted(clinicId: string, n: number) {
  const tiers = tierInputs.get(clinicId);
  if (!tiers) return null;
  return quote({ ...tiers, professionals: Math.max(n, 1) }).periodCents;
}
const tierInputs = new Map<string, Omit<Parameters<typeof quote>[0], "professionals">>();
