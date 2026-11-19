import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { bono, bonoType } from "../db/schema.js";
import {
  bonosForSession,
  cancelBono,
  clinicService,
  stopUsingBono,
  useBono,
  listBonos,
  listBonoTypes,
  parseBonoType,
  payBono,
  sellBono,
  type BonoHolder,
  type BonoTypeInput,
} from "../lib/bonos.js";
import { isIsoDate, PAYMENT_METHODS, type PaymentMethod } from "../lib/charges.js";
import { ChargeError } from "../lib/payments.js";

// Bonos of the session's active clinic (COBROS.md). Part of the "invoicing"
// feature; roles in bono routes (charge.routes.ts)

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = (res: Response) => send(res, 404, "BONO_TYPE_NOT_FOUND", "El bono no existe");

const isUniqueViolation = (error: unknown) =>
  (error as { cause?: { code?: string } })?.cause?.code === "23505" ||
  (error as { code?: string })?.code === "23505";

// GET /clinic/charges/bono-types -> { bonoTypes }
export const getBonoTypes = async (req: Request, res: Response) => {
  res.json({ bonoTypes: await listBonoTypes(req.clinicId!) });
};

// POST /clinic/charges/bono-types -> 201 { bonoType }
export const createBonoType = async (req: Request, res: Response) => {
  const input = parseBonoType(req.body ?? {});
  if (typeof input === "string") return send(res, 400, "INVALID_BONO_TYPE", input);
  const svc = await clinicService(req.clinicId!, input.serviceId);
  if (!svc || !svc.isActive) return send(res, 400, "INVALID_SERVICE", "El servicio no existe o está desactivado");
  try {
    const [created] = await db
      .insert(bonoType)
      .values({ ...input, organizationId: req.clinicId!, serviceName: svc.name })
      .returning({ id: bonoType.id });
    const list = await listBonoTypes(req.clinicId!);
    res.status(201).json({ bonoType: list.find((t) => t.id === created!.id) });
  } catch (error) {
    if (isUniqueViolation(error)) return send(res, 409, "NAME_TAKEN", "Ya hay un bono con ese nombre");
    throw error;
  }
};

// PUT /clinic/charges/bono-types/:bonoTypeId -> { bonoType }
// Bonos already sold don't change (they keep what they were sold with)
export const updateBonoType = async (req: Request<{ bonoTypeId: string }>, res: Response) => {
  if (!UUID.test(req.params.bonoTypeId)) return notFound(res);
  const [existing] = await db
    .select({ id: bonoType.id })
    .from(bonoType)
    .where(and(eq(bonoType.id, req.params.bonoTypeId), eq(bonoType.organizationId, req.clinicId!)));
  if (!existing) return notFound(res);
  const input = parseBonoType(req.body ?? {});
  if (typeof input === "string") return send(res, 400, "INVALID_BONO_TYPE", input);
  const svc = await clinicService(req.clinicId!, input.serviceId);
  if (!svc) return send(res, 400, "INVALID_SERVICE", "El servicio no existe");
  try {
    const updated = await db
      .update(bonoType)
      .set({ ...input, serviceName: svc.name })
      .where(and(eq(bonoType.id, req.params.bonoTypeId), eq(bonoType.organizationId, req.clinicId!)))
      .returning({ id: bonoType.id });
    if (updated.length === 0) return notFound(res);
    const list = await listBonoTypes(req.clinicId!);
    res.json({ bonoType: list.find((t) => t.id === req.params.bonoTypeId) });
  } catch (error) {
    if (isUniqueViolation(error)) return send(res, 409, "NAME_TAKEN", "Ya hay un bono con ese nombre");
    throw error;
  }
};

// DELETE /clinic/charges/bono-types/:bonoTypeId -> 204
// Only types never sold; the others are deactivated
export const deleteBonoType = async (req: Request<{ bonoTypeId: string }>, res: Response) => {
  if (!UUID.test(req.params.bonoTypeId)) return notFound(res);
  const [sold] = await db
    .select({ id: bono.id })
    .from(bono)
    .where(and(eq(bono.organizationId, req.clinicId!), eq(bono.bonoTypeId, req.params.bonoTypeId)))
    .limit(1);
  if (sold) {
    return send(res, 409, "BONO_TYPE_SOLD", "Ya se ha vendido algún bono de este tipo: desactívalo en vez de eliminarlo");
  }
  const deleted = await db
    .delete(bonoType)
    .where(and(eq(bonoType.id, req.params.bonoTypeId), eq(bonoType.organizationId, req.clinicId!)))
    .returning({ id: bonoType.id });
  if (deleted.length === 0) return notFound(res);
  res.status(204).end();
};

// ── Selling bonos (H5) ───────────────────────────────────────────────────

const MAX_TEXT = 500;
const optionalText = (v: unknown): string | null | undefined =>
  v === undefined || v === null ? null : typeof v !== "string" || v.length > MAX_TEXT ? undefined : v.trim() || null;
const isMethod = (v: unknown): v is PaymentMethod => PAYMENT_METHODS.includes(v as PaymentMethod);
const isPrice = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 10_000_00;

async function run(res: Response, change: () => Promise<unknown>, success: (result: any) => unknown) {
  try {
    await success(await change());
  } catch (error) {
    if (error instanceof ChargeError) return send(res, error.status, error.code, error.message);
    throw error;
  }
}

const actorOf = (req: Request) => ({ clinicId: req.clinicId!, userId: req.user!.id, role: req.clinicRole! });

// Payment part of a body: { method, paidOn?, note? } -> parsed, or an error message
function parsePay(v: unknown): { method: PaymentMethod; paidOn?: string; note: string | null } | string {
  const p = (v ?? {}) as Record<string, unknown>;
  if (!isMethod(p.method)) return "Forma de pago no válida";
  if (p.paidOn !== undefined && !isIsoDate(p.paidOn)) return "paidOn debe ser una fecha AAAA-MM-DD";
  const note = optionalText(p.note);
  if (note === undefined) return "La nota es demasiado larga";
  return { method: p.method, ...(p.paidOn ? { paidOn: p.paidOn as string } : {}), note };
}

// GET /clinic/charges/bonos?patientId= -> { bonos }
export const getBonos = async (req: Request, res: Response) => {
  const patientId = typeof req.query.patientId === "string" && UUID.test(req.query.patientId) ? req.query.patientId : undefined;
  res.json({ bonos: await listBonos(req.clinicId!, { patientId }) });
};

// POST /clinic/charges/bonos -> 201 { bono }
// body: { patient: { patientId } | { firstName, lastName, contact },
//         bonoTypeId | custom: { name, serviceId, kind, sessions, validityDays, sessionsPerWeek, priceCents },
//         validFrom?, month?, priceCents?, note?, pay: { method, paidOn?, note? } | null }
export const postBono = async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const p = body.patient ?? {};
  let patient: BonoHolder | null = null;
  if (UUID.test(p.patientId ?? "")) patient = { patientId: p.patientId };
  else {
    const firstName = typeof p.firstName === "string" ? p.firstName.trim() : "";
    const lastName = typeof p.lastName === "string" ? p.lastName.trim() : "";
    const contact = typeof p.contact === "string" ? p.contact.trim() : "";
    if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
      return send(res, 400, "INVALID_PATIENT", "Elige un paciente o escribe nombre y apellidos");
    }
    if (!contact || contact.length > 100) {
      return send(res, 400, "CONTACT_REQUIRED", "Sin ficha, escribe un teléfono o email para distinguir al paciente");
    }
    patient = { firstName, lastName, contact };
  }

  let custom: BonoTypeInput | undefined;
  if (body.bonoTypeId !== undefined) {
    if (!UUID.test(body.bonoTypeId)) return send(res, 400, "INVALID_BONO", "Elige un tipo de bono");
  } else {
    const parsed = parseBonoType(body.custom ?? {});
    if (typeof parsed === "string") return send(res, 400, "INVALID_BONO", parsed);
    custom = parsed;
  }
  if (body.validFrom !== undefined && !isIsoDate(body.validFrom)) {
    return send(res, 400, "INVALID_DATE", "validFrom debe ser una fecha AAAA-MM-DD");
  }
  if (body.month !== undefined && (typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month))) {
    return send(res, 400, "INVALID_MONTH", "month debe tener el formato AAAA-MM");
  }
  if (body.priceCents !== undefined && !isPrice(body.priceCents)) {
    return send(res, 400, "INVALID_PRICE", "El precio tiene que ser mayor que 0");
  }
  const note = optionalText(body.note);
  if (note === undefined) return send(res, 400, "INVALID_NOTE", "La nota es demasiado larga");
  let pay = null;
  if (body.pay !== null && body.pay !== undefined) {
    const parsed = parsePay(body.pay);
    if (typeof parsed === "string") return send(res, 400, "INVALID_PAYMENT", parsed);
    pay = parsed;
  }

  await run(
    res,
    () =>
      sellBono(actorOf(req), {
        patient,
        bonoTypeId: body.bonoTypeId,
        custom,
        validFrom: body.validFrom,
        month: body.month,
        priceCents: body.priceCents,
        note,
        pay,
      }),
    async (sold) => {
      const [listed] = await listBonos(req.clinicId!, { bonoIds: [sold.id] });
      res.status(201).json({ bono: listed });
    },
  );
};

const bonoIdOf = (req: Request<{ bonoId: string }>, res: Response) => {
  if (UUID.test(req.params.bonoId)) return req.params.bonoId;
  send(res, 404, "BONO_NOT_FOUND", "El bono no existe");
  return null;
};

// POST /clinic/charges/bonos/:bonoId/pay   body: { method, paidOn?, note? } -> 201 { payment: { id } }
export const postBonoPay = async (req: Request<{ bonoId: string }>, res: Response) => {
  const id = bonoIdOf(req, res);
  if (!id) return;
  const pay = parsePay(req.body);
  if (typeof pay === "string") return send(res, 400, "INVALID_PAYMENT", pay);
  await run(res, () => payBono(actorOf(req), id, pay), (p) => res.status(201).json({ payment: { id: p.id } }));
};

// POST /clinic/charges/bonos/:bonoId/cancel
// body: { reason, refund?: { amountCents, method } } -> 204
export const postBonoCancel = async (req: Request<{ bonoId: string }>, res: Response) => {
  const id = bonoIdOf(req, res);
  if (!id) return;
  const reason = optionalText(req.body?.reason);
  if (!reason) return send(res, 400, "REASON_REQUIRED", "Escribe por qué se anula");
  const r = req.body?.refund;
  let refund = null;
  if (r !== undefined && r !== null) {
    if (!isPrice(r.amountCents) || !isMethod(r.method)) {
      return send(res, 400, "INVALID_REFUND", "Indica cuánto se devuelve y cómo");
    }
    refund = { amountCents: r.amountCents as number, method: r.method as PaymentMethod };
  }
  await run(res, () => cancelBono(actorOf(req), id, { reason, refund }), () => res.status(204).end());
};

// ── Paying sessions with a bono (H6) ─────────────────────────────────────

const sessionIdOf = (req: Request<{ sessionId: string }>, res: Response) => {
  if (UUID.test(req.params.sessionId)) return req.params.sessionId;
  send(res, 404, "SESSION_NOT_FOUND", "La sesión no existe");
  return null;
};

// GET /clinic/charges/sessions/:sessionId/bonos -> { options: [{ bono, usable, reason, overridable }] }
// The person's bonos and whether each one can pay this session (and why not)
export const getSessionBonos = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  await run(res, () => bonosForSession(req.clinicId!, id), (options) => res.json({ options }));
};

// PUT /clinic/charges/sessions/:sessionId/bono   body: { bonoId, overLimitReason? } -> 204
// overLimitReason: to go past a monthly bono's weekly limit on purpose
export const putSessionBono = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  const { bonoId, overLimitReason } = req.body ?? {};
  if (typeof bonoId !== "string" || !UUID.test(bonoId)) return send(res, 400, "INVALID_BONO", "Elige un bono");
  const reason = optionalText(overLimitReason);
  if (reason === undefined) return send(res, 400, "INVALID_REASON", "El motivo es demasiado largo");
  await run(res, () => useBono(actorOf(req), id, { bonoId, overLimitReason: reason }), () => res.status(204).end());
};

// DELETE /clinic/charges/sessions/:sessionId/bono -> 204 (the bono gets the session back)
export const deleteSessionBono = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  await run(res, () => stopUsingBono(actorOf(req), id), () => res.status(204).end());
};
