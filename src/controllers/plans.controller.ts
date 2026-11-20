import type { Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicAddon, clinicBilling, clinicFeature, clinicProfessionalLog, featurePrice, organization, plan, planFeature } from "../db/schema.js";
import { CLINIC_FEATURES, isClinicFeature } from "../lib/features.js";
import { clinicalDocumentsReady, loadContracts, loadFeaturePrices, loadPlans, parseContract, parsePlan, professionalAlerts } from "../lib/plans.js";

// Planes (super-admin only, checked in the routes): the plans and their
// prices, what each feature costs as an extra, and each clinic's contract.
// Rules and prices in src/lib/plans.ts

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /admin/plans -> { plans, featurePrices, clinicsByPlan }
export const listPlans = async (_req: Request, res: Response) => {
  const [plans, prices, used] = await Promise.all([
    loadPlans(),
    loadFeaturePrices(),
    db.select({ planId: clinicBilling.planId }).from(clinicBilling),
  ]);
  const clinicsByPlan: Record<string, number> = {};
  for (const u of used) if (u.planId) clinicsByPlan[u.planId] = (clinicsByPlan[u.planId] ?? 0) + 1;
  res.json({
    plans,
    featurePrices: CLINIC_FEATURES.map((feature) => ({ feature, monthlyCents: prices.get(feature) ?? null })),
    clinicsByPlan,
  });
};

const isNameTaken = (error: unknown) =>
  (error as { cause?: { code?: string } })?.cause?.code === "23505" || (error as { code?: string })?.code === "23505";

// POST /admin/plans -> 201 { planId }
export const createPlan = async (req: Request, res: Response) => {
  const input = parsePlan(req.body ?? {});
  if (typeof input === "string") return send(res, 400, "INVALID_PLAN", input);
  const { features, ...fields } = input;
  try {
    const planId = await db.transaction(async (tx) => {
      const [created] = await tx.insert(plan).values(fields).returning({ id: plan.id });
      if (features.length) await tx.insert(planFeature).values(features.map((feature) => ({ planId: created!.id, feature })));
      return created!.id;
    });
    res.status(201).json({ planId });
  } catch (error) {
    if (isNameTaken(error)) return send(res, 409, "PLAN_NAME_TAKEN", "Ya hay un plan con ese nombre");
    throw error;
  }
};

// PUT /admin/plans/:planId -> 204. The whole plan. Clinics with it see the new
// prices from now on (what was already charged isn't recalculated)
export const updatePlan = async (req: Request<{ planId: string }>, res: Response) => {
  const { planId } = req.params;
  if (!UUID.test(planId)) return send(res, 404, "PLAN_NOT_FOUND", "Este plan no existe");
  const input = parsePlan(req.body ?? {});
  if (typeof input === "string") return send(res, 400, "INVALID_PLAN", input);
  const { features, ...fields } = input;
  try {
    const found = await db.transaction(async (tx) => {
      const [updated] = await tx.update(plan).set(fields).where(eq(plan.id, planId)).returning({ id: plan.id });
      if (!updated) return false;
      await tx.delete(planFeature).where(eq(planFeature.planId, planId));
      if (features.length) await tx.insert(planFeature).values(features.map((feature) => ({ planId, feature })));
      return true;
    });
    if (!found) return send(res, 404, "PLAN_NOT_FOUND", "Este plan no existe");
    res.status(204).end();
  } catch (error) {
    if (isNameTaken(error)) return send(res, 409, "PLAN_NAME_TAKEN", "Ya hay un plan con ese nombre");
    throw error;
  }
};

// DELETE /admin/plans/:planId -> 204. Only plans no clinic has: the others are archived
export const deletePlan = async (req: Request<{ planId: string }>, res: Response) => {
  const { planId } = req.params;
  if (!UUID.test(planId)) return send(res, 404, "PLAN_NOT_FOUND", "Este plan no existe");
  const [inUse] = await db.select({ id: clinicBilling.organizationId }).from(clinicBilling).where(eq(clinicBilling.planId, planId)).limit(1);
  if (inUse) return send(res, 409, "PLAN_IN_USE", "Hay clínicas con este plan: archívalo en lugar de borrarlo");
  const deleted = await db.delete(plan).where(eq(plan.id, planId)).returning({ id: plan.id });
  if (!deleted.length) return send(res, 404, "PLAN_NOT_FOUND", "Este plan no existe");
  res.status(204).end();
};

// PUT /admin/plans/feature-prices/:feature   body: { monthlyCents: number | null } -> 204
// What a feature costs a month when it's contracted outside the plan
export const setFeaturePrice = async (req: Request<{ feature: string }>, res: Response) => {
  const { feature } = req.params;
  if (!isClinicFeature(feature)) return send(res, 400, "INVALID_FEATURE", "Esa funcionalidad no existe");
  const cents = req.body?.monthlyCents ?? null;
  if (cents !== null && !(Number.isInteger(cents) && cents >= 0 && cents <= 10_000_000)) {
    return send(res, 400, "INVALID_PRICE", "El precio no es válido");
  }
  await db
    .insert(featurePrice)
    .values({ feature, monthlyCents: cents })
    .onConflictDoUpdate({ target: featurePrice.feature, set: { monthlyCents: cents } });
  res.status(204).end();
};

// GET /admin/plans/contracts -> { clinics }
// Every clinic with its contract: plan, cycle, professionals, price, and each
// feature contracted / active (the Contratos dashboard)
export const listContracts = async (_req: Request, res: Response) => {
  const clinics = await db
    .select({ id: organization.id, name: organization.name, slug: organization.slug, status: organization.status, createdAt: organization.createdAt })
    .from(organization)
    .orderBy(organization.name);
  const ids = clinics.map((c) => c.id);
  const contracts = await loadContracts(ids);
  const alerts = await professionalAlerts(ids);
  res.json({
    clinics: clinics.map((c) => {
      const a = alerts.get(c.id)!;
      return {
        ...c,
        contract: contracts.get(c.id)!,
        // Tier changes not reviewed yet, the last few changes, and "tiene 5, paga por 3"
        professionalAlerts: { unreviewed: a.unreviewed, overrideBelow: a.overrideBelow, changes: a.changes.slice(0, 5) },
      };
    }),
  });
};

// ---------- A clinic's contract ----------

type ClinicParams = { clinicId: string };

async function clinicExists(clinicId: string) {
  const [found] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, clinicId)).limit(1);
  return !!found;
}

// GET /admin/billing/:clinicId/contract -> { contract, clinicalDocumentsReady }
export const getContract = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  if (!(await clinicExists(clinicId))) return send(res, 404, "CLINIC_NOT_FOUND", "Esta clínica no existe");
  const contract = (await loadContracts([clinicId])).get(clinicId)!;
  const alerts = (await professionalAlerts([clinicId])).get(clinicId)!;
  res.json({
    contract,
    clinicalDocumentsReady: await clinicalDocumentsReady(clinicId),
    // Its history of professionals (newest first) and what needs a look
    professionalAlerts: { unreviewed: alerts.unreviewed, overrideBelow: alerts.overrideBelow, changes: alerts.changes.slice(0, 24) },
  });
};

// PUT /admin/billing/:clinicId/contract -> { contract }
// body: { planId, cycle, professionalsOverride, discountPercent, discountNote,
//         priceOverrideCents, notes, addons: [{ feature, priceCents }] }
// Saving the contract doesn't switch features on or off: "Aplicar plan" does
export const saveContract = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  if (!(await clinicExists(clinicId))) return send(res, 404, "CLINIC_NOT_FOUND", "Esta clínica no existe");
  const input = parseContract(req.body ?? {});
  if (typeof input === "string") return send(res, 400, "INVALID_CONTRACT", input);
  const [current] = await db.select({ planId: clinicBilling.planId }).from(clinicBilling).where(eq(clinicBilling.organizationId, clinicId));
  if (input.planId) {
    const [p] = await db.select({ archived: plan.archived }).from(plan).where(eq(plan.id, input.planId)).limit(1);
    if (!p) return send(res, 400, "PLAN_NOT_FOUND", "Ese plan no existe");
    // An archived plan can stay on the clinic that has it, but not be given anew
    if (p.archived && current?.planId !== input.planId) return send(res, 400, "PLAN_ARCHIVED", "Ese plan está archivado");
  }
  const { addons, ...fields } = input;
  await db.transaction(async (tx) => {
    // A new plan (or the first one): earlier changes in professionals were
    // under another price, and the super-admin is setting this one looking at
    // the count they have now. They aren't tier changes to review any more
    if ((current?.planId ?? null) !== input.planId) {
      await tx
        .update(clinicProfessionalLog)
        .set({ reviewedAt: new Date(), reviewedBy: req.user!.id })
        .where(and(eq(clinicProfessionalLog.organizationId, clinicId), isNull(clinicProfessionalLog.reviewedAt)));
    }
    await tx
      .insert(clinicBilling)
      .values({ organizationId: clinicId, ...fields })
      .onConflictDoUpdate({ target: clinicBilling.organizationId, set: fields });
    await tx.delete(clinicAddon).where(eq(clinicAddon.organizationId, clinicId));
    if (addons.length) {
      await tx.insert(clinicAddon).values(addons.map((a) => ({ organizationId: clinicId, ...a, createdBy: req.user!.id })));
    }
  });
  const contract = (await loadContracts([clinicId])).get(clinicId)!;
  res.json({ contract });
};

// POST /admin/billing/:clinicId/contract/apply -> { enabled, skipped }
// Switches on what's contracted and still off. Never switches anything off
// (an active feature that isn't contracted may be a trial: the panel warns).
// The historia clínica waits for the signed DPA and health annex
export const applyContract = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  if (!(await clinicExists(clinicId))) return send(res, 404, "CLINIC_NOT_FOUND", "Esta clínica no existe");
  const contract = (await loadContracts([clinicId])).get(clinicId)!;
  const missing = contract.features.filter((f) => f.contracted && !f.active).map((f) => f.feature);
  const docsReady = await clinicalDocumentsReady(clinicId);
  const skipped = missing
    .filter((f) => f === "clinical_history" && !docsReady)
    .map((feature) => ({ feature, reason: "Falta el encargo del tratamiento o el anexo de datos de salud firmados" }));
  const enable = missing.filter((f) => !skipped.some((s) => s.feature === f));
  if (enable.length) {
    await db
      .insert(clinicFeature)
      .values(enable.map((feature) => ({ organizationId: clinicId, feature, enabledBy: req.user!.id })))
      .onConflictDoNothing();
  }
  res.json({ enabled: enable, skipped });
};

// POST /admin/billing/:clinicId/professionals/review -> 204
// The super-admin has seen this clinic's changes in professionals
export const reviewProfessionalChanges = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  if (!(await clinicExists(clinicId))) return send(res, 404, "CLINIC_NOT_FOUND", "Esta clínica no existe");
  await db
    .update(clinicProfessionalLog)
    .set({ reviewedAt: new Date(), reviewedBy: req.user!.id })
    .where(and(eq(clinicProfessionalLog.organizationId, clinicId), isNull(clinicProfessionalLog.reviewedAt)));
  res.status(204).end();
};

// GET /admin/plans/alerts -> { clinics } (the menu badge): clinics with a tier
// change not reviewed yet, or professionals fixed below what they have
export const countProfessionalAlerts = async (_req: Request, res: Response) => {
  const clinics = await db.select({ id: organization.id }).from(organization);
  const alerts = await professionalAlerts(clinics.map((c) => c.id));
  res.json({ clinics: [...alerts.values()].filter((a) => a.unreviewed > 0 || a.overrideBelow).length });
};

// For the Pagos list: each clinic's plan and price (see billing.controller.ts)
export async function contractsFor(clinicIds: string[]) {
  const contracts = await loadContracts(clinicIds);
  return new Map(
    [...contracts].map(([id, c]) => [
      id,
      {
        planName: c.plan?.name ?? null,
        cycle: c.cycle,
        monthlyCents: c.quote.monthlyCents,
        periodCents: c.quote.periodCents,
        mismatches: c.features.filter((f) => !!f.contracted !== f.active).length,
      },
    ]),
  );
}
