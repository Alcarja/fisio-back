import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicChargeSettings, payment } from "../db/schema.js";
import {
  firstPaidSessionDay,
  getChargeSettings,
  isIsoDate,
  loadSessions,
  parseChargeSettings,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "../lib/charges.js";
import { listBonos } from "../lib/bonos.js";
import { buildMonthCsv, loadMonthMovements, movementTotals } from "../lib/chargesExport.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import {
  cancelManualSession,
  ChargeError,
  chargeSessions,
  createManualSession,
  loadPayment,
  movePayment,
  refundPayment,
  setSessionPrice,
  unwaiveSession,
  voidPayment,
  markSessionOutcome,
  waiveSession,
} from "../lib/payments.js";
import { addDaysIso, utcToZoned } from "../lib/timezone.js";

// Cobros y bonos of the session's active clinic (COBROS.md). Every route
// needs the "invoicing" feature and a role from lib/charges.ts (charge.routes.ts)

// GET /clinic/charges/settings -> { settings }
export const getSettings = async (req: Request, res: Response) => {
  res.json({ settings: await getChargeSettings(req.clinicId!) });
};

// PUT /clinic/charges/settings   body: { startsOn, chargeNoShows } -> { settings }
export const updateSettings = async (req: Request, res: Response) => {
  const settings = parseChargeSettings(req.body ?? {});
  if (typeof settings === "string") {
    res.status(400).json({ error: { code: "INVALID_SETTINGS", message: settings } });
    return;
  }
  // Sessions before the start date disappear from Cobros: it can't move past
  // one that was already charged (its payment would vanish from view)
  const firstPaid = await firstPaidSessionDay(req.clinicId!);
  if (firstPaid && settings.startsOn > firstPaid) {
    res.status(409).json({
      error: {
        code: "STARTS_AFTER_PAYMENTS",
        message: `Hay sesiones cobradas desde el ${firstPaid}: la fecha de inicio no puede ser posterior`,
      },
    });
    return;
  }
  await db
    .insert(clinicChargeSettings)
    .values({ organizationId: req.clinicId!, ...settings, updatedBy: req.user!.id })
    .onConflictDoUpdate({
      target: clinicChargeSettings.organizationId,
      set: { ...settings, updatedBy: req.user!.id, updatedAt: new Date() },
    });
  res.json({ settings });
};

// Longest range one request can ask for (a quarter, give or take)
const MAX_RANGE_DAYS = 93;

// GET /clinic/charges/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD
// -> { from, to, settings, sessions: ChargeSession[] }
// Every patient of every non-cancelled appointment in those days (both
// included, clinic time), from the clinic's startsOn on. Read only (H1)
export const listSessions = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    res.status(400).json({
      error: { code: "INVALID_RANGE", message: "from y to deben ser fechas AAAA-MM-DD, from ≤ to" },
    });
    return;
  }
  if (addDaysIso(from, MAX_RANGE_DAYS) <= to) {
    res.status(400).json({
      error: { code: "RANGE_TOO_LONG", message: `Como mucho ${MAX_RANGE_DAYS} días a la vez` },
    });
    return;
  }
  const settings = await getChargeSettings(req.clinicId!);
  const sessions = await loadSessions(req.clinicId!, { from, to }, settings);
  res.json({ from, to, settings, sessions });
};

// How far ahead the pending view looks: future sessions only show there when
// they were paid in advance and then cancelled (review)
const PENDING_AHEAD_DAYS = 400;

// GET /clinic/charges/pending -> { settings, sessions: ChargeSession[] }
// Everything still to sort out since the clinic's startsOn: pending,
// to_confirm and review sessions, oldest first, and today's still to come
export const listPending = async (req: Request, res: Response) => {
  const settings = await getChargeSettings(req.clinicId!);
  const timeZone = await loadTimezone(req.clinicId!);
  const today = utcToZoned(new Date(), timeZone).date;
  const sessions = await loadSessions(
    req.clinicId!,
    { from: settings.startsOn, to: addDaysIso(today, PENDING_AHEAD_DAYS) },
    settings,
  );
  // Bonos sold as pending (not cancelled): owed too
  const bonos = (await listBonos(req.clinicId!)).filter((b) => !b.payment && b.status !== "cancelled");
  res.json({
    settings,
    // Also today's sessions still to come with something to charge: people
    // often pay when they arrive
    sessions: sessions.filter(
      (s) =>
        ["pending", "to_confirm", "review"].includes(s.state) ||
        (s.state === "upcoming" && s.priceCents > 0 && utcToZoned(s.startsAt, timeZone).date === today),
    ),
    bonos,
  });
};

// ── Changes ──────────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRICE_CENTS = 10_000_00; // 10.000 €: a typo, not a session
const MAX_TEXT = 500;

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
const isPrice = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_PRICE_CENTS;
const isMethod = (value: unknown): value is PaymentMethod =>
  PAYMENT_METHODS.includes(value as PaymentMethod);

// Optional text: trimmed, null when empty. undefined if it isn't valid
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > MAX_TEXT) return undefined;
  return value.trim() || null;
}
function requiredText(value: unknown): string | null {
  const text = optionalText(value);
  return text ?? null;
}

const actorOf = (req: Request) => ({
  clinicId: req.clinicId!,
  userId: req.user!.id,
  role: req.clinicRole!,
});

// Runs a change and turns its expected errors into responses
async function run(
  res: Response,
  change: () => Promise<unknown>,
  success: (result: any) => unknown,
) {
  try {
    await success(await change());
  } catch (error) {
    if (error instanceof ChargeError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }
}

// POST /clinic/charges/payments -> 201 { payment: { id } }
// body: { sessions: [{ sessionId, priceCents? }], method, paidOn?, note? }
// sessionId: ChargeSession.id (a calendar session or a manual one)
export const createPayment = async (req: Request, res: Response) => {
  const { sessions, method, paidOn, note } = req.body ?? {};
  if (
    !Array.isArray(sessions) ||
    sessions.length === 0 ||
    sessions.length > 100 ||
    !sessions.every(
      (s) => isUuid(s?.sessionId) && (s.priceCents === undefined || isPrice(s.priceCents)),
    ) ||
    new Set(sessions.map((s) => s.sessionId)).size !== sessions.length
  ) {
    return badRequest(res, "INVALID_SESSIONS", "Elige una o más sesiones distintas, con precios válidos");
  }
  if (!isMethod(method)) return badRequest(res, "INVALID_METHOD", "Forma de pago no válida");
  if (paidOn !== undefined && !isIsoDate(paidOn)) {
    return badRequest(res, "INVALID_DATE", "paidOn debe ser una fecha AAAA-MM-DD");
  }
  const text = optionalText(note);
  if (text === undefined) return badRequest(res, "INVALID_NOTE", "La nota es demasiado larga");

  await run(
    res,
    () => chargeSessions(actorOf(req), { sessions, method, paidOn, note: text }),
    (created) => res.status(201).json({ payment: { id: created.id } }),
  );
};

// GET /clinic/charges/payments/:paymentId -> { payment }
export const getPayment = async (req: Request<{ paymentId: string }>, res: Response) => {
  const found = isUuid(req.params.paymentId)
    ? await loadPayment(req.clinicId!, req.params.paymentId)
    : null;
  if (!found) {
    res.status(404).json({ error: { code: "PAYMENT_NOT_FOUND", message: "El cobro no existe" } });
    return;
  }
  res.json({ payment: found });
};

const paymentIdOf = (req: Request<{ paymentId: string }>, res: Response) => {
  if (isUuid(req.params.paymentId)) return req.params.paymentId;
  res.status(404).json({ error: { code: "PAYMENT_NOT_FOUND", message: "El cobro no existe" } });
  return null;
};

// POST /clinic/charges/payments/:paymentId/void   body: { reason } -> 204
export const postVoid = async (req: Request<{ paymentId: string }>, res: Response) => {
  const paymentId = paymentIdOf(req, res);
  if (!paymentId) return;
  const reason = requiredText(req.body?.reason);
  if (!reason) return badRequest(res, "REASON_REQUIRED", "Escribe por qué se anula");
  await run(res, () => voidPayment(actorOf(req), paymentId, reason), () => res.status(204).end());
};

// POST /clinic/charges/payments/:paymentId/refund
// body: { method, note?, chargeIds? } -> 201 { refund: { id } }
// chargeIds: the sessions to refund (session_charge ids); missing = all of them
export const postRefund = async (req: Request<{ paymentId: string }>, res: Response) => {
  const paymentId = paymentIdOf(req, res);
  if (!paymentId) return;
  const { method, note, chargeIds } = req.body ?? {};
  if (!isMethod(method)) return badRequest(res, "INVALID_METHOD", "Forma de pago no válida");
  const text = optionalText(note);
  if (text === undefined) return badRequest(res, "INVALID_NOTE", "La nota es demasiado larga");
  // Which sessions to refund. Missing: all that the payment still pays
  if (
    chargeIds !== undefined &&
    (!Array.isArray(chargeIds) || chargeIds.length === 0 || chargeIds.length > 100 || !chargeIds.every(isUuid))
  ) {
    return badRequest(res, "INVALID_SESSIONS", "Elige qué sesiones se devuelven");
  }
  await run(
    res,
    () => refundPayment(actorOf(req), paymentId, { method, note: text, chargeIds }),
    (refund) => res.status(201).json({ refund: { id: refund.id } }),
  );
};

// POST /clinic/charges/payments/:paymentId/move
// body: { fromChargeId, toSessionId } -> 204
export const postMove = async (req: Request<{ paymentId: string }>, res: Response) => {
  const paymentId = paymentIdOf(req, res);
  if (!paymentId) return;
  const { fromChargeId, toSessionId } = req.body ?? {};
  if (!isUuid(fromChargeId) || !isUuid(toSessionId)) {
    return badRequest(res, "INVALID_SESSIONS", "Indica la sesión de origen y la de destino");
  }
  await run(
    res,
    () => movePayment(actorOf(req), paymentId, { fromChargeId, toSessionId }),
    () => res.status(204).end(),
  );
};

const sessionIdOf = (req: Request<{ sessionId: string }>, res: Response) => {
  if (isUuid(req.params.sessionId)) return req.params.sessionId;
  res.status(404).json({ error: { code: "SESSION_NOT_FOUND", message: "La sesión no existe" } });
  return null;
};

// PUT /clinic/charges/sessions/:sessionId/price   body: { priceCents } -> 204
export const putPrice = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  const { priceCents } = req.body ?? {};
  if (!isPrice(priceCents)) return badRequest(res, "INVALID_PRICE", "Precio no válido");
  await run(res, () => setSessionPrice(actorOf(req), id, priceCents), () => res.status(204).end());
};

// PUT /clinic/charges/sessions/:sessionId/waive   body: { reason } -> 204
export const putWaive = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  const reason = requiredText(req.body?.reason);
  if (!reason) return badRequest(res, "REASON_REQUIRED", "Escribe por qué no se cobra");
  await run(res, () => waiveSession(actorOf(req), id, reason), () => res.status(204).end());
};

// DELETE /clinic/charges/sessions/:sessionId/waive -> 204
export const deleteWaive = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  await run(res, () => unwaiveSession(actorOf(req), id), () => res.status(204).end());
};

// POST /clinic/charges/sessions/:sessionId/outcome -> 204
// body: { outcome: "came" | "no_show" }. A calendar session nobody marked
// yet, marked from Cobros
export const postOutcome = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  const result = req.body?.outcome;
  if (result !== "came" && result !== "no_show") {
    return badRequest(res, "INVALID_OUTCOME", "Indica si vino o no vino");
  }
  await run(res, () => markSessionOutcome(actorOf(req), id, result), () => res.status(204).end());
};

// ── Manual sessions (not in the calendar) ───────────────────────────────

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// POST /clinic/charges/manual-sessions -> 201 { session: ChargeSession }
// body: { patient: { patientId } | { firstName, lastName }, serviceId,
//         physioId?, date, time?, priceCents?, note }
// note (required): why it isn't in the calendar
export const createManual = async (req: Request, res: Response) => {
  const { patient, serviceId, physioId, date, time, priceCents, note } = req.body ?? {};
  let who: { patientId: string } | { firstName: string; lastName: string } | null = null;
  if (patient && isUuid(patient.patientId)) {
    who = { patientId: patient.patientId };
  } else if (patient && typeof patient.firstName === "string" && typeof patient.lastName === "string") {
    const firstName = patient.firstName.trim();
    const lastName = patient.lastName.trim();
    if (firstName && lastName && firstName.length <= 100 && lastName.length <= 100) {
      who = { firstName, lastName };
    }
  }
  if (!who) return badRequest(res, "INVALID_PATIENT", "Elige un paciente o escribe nombre y apellidos");
  if (!isUuid(serviceId)) return badRequest(res, "INVALID_SERVICE", "Elige un servicio");
  if (physioId !== undefined && physioId !== null && (typeof physioId !== "string" || !physioId)) {
    return badRequest(res, "INVALID_PHYSIO", "Profesional no válido");
  }
  if (!isIsoDate(date)) return badRequest(res, "INVALID_DATE", "date debe ser una fecha AAAA-MM-DD");
  if (time !== undefined && (typeof time !== "string" || !TIME_PATTERN.test(time))) {
    return badRequest(res, "INVALID_TIME", "time debe tener el formato HH:MM");
  }
  if (priceCents !== undefined && !isPrice(priceCents)) {
    return badRequest(res, "INVALID_PRICE", "Precio no válido");
  }
  const reason = requiredText(note);
  if (!reason) return badRequest(res, "REASON_REQUIRED", "Escribe por qué no está en la agenda");

  await run(
    res,
    () =>
      createManualSession(actorOf(req), {
        patient: who,
        serviceId,
        physioId: physioId ?? null,
        date,
        time,
        priceCents,
        note: reason,
      }),
    async (row) => {
      // Answer with the session as the lists show it
      const settings = await getChargeSettings(req.clinicId!);
      const sessions = await loadSessions(req.clinicId!, { from: date, to: date }, settings);
      res.status(201).json({ session: sessions.find((s) => s.id === row.id) ?? null });
    },
  );
};

// POST /clinic/charges/manual-sessions/:sessionId/cancel   body: { reason } -> 204
export const cancelManual = async (req: Request<{ sessionId: string }>, res: Response) => {
  const id = sessionIdOf(req, res);
  if (!id) return;
  const reason = requiredText(req.body?.reason);
  if (!reason) return badRequest(res, "REASON_REQUIRED", "Escribe por qué se anula");
  await run(res, () => cancelManualSession(actorOf(req), id, reason), () => res.status(204).end());
};

// GET /clinic/charges/movements?month=YYYY-MM&voided=1
// -> { movements, totals: { charged, refunded, net, byMethod } }
// All the money of a month (payments of sessions, bonos sold, refunds), the
// same rows as the accountant's CSV. voided=1 also lists voided payments
// (marked, never in the totals)
export const listMovements = async (req: Request, res: Response) => {
  const { month, voided } = req.query;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return badRequest(res, "INVALID_MONTH", "month debe tener el formato AAAA-MM");
  }
  const movements = await loadMonthMovements(req.clinicId!, month, { includeVoided: voided === "1" });
  const totals = movementTotals(movements);
  res.json({
    month,
    movements: movements.map(({ nif: _nif, address: _a, postalCode: _p, city: _c, ...m }) => m),
    totals: {
      charged: totals.charged,
      refunded: totals.refunded,
      net: totals.charged + totals.refunded,
      byMethod: Object.fromEntries(totals.byMethod),
    },
  });
};

// GET /clinic/charges/archive -> { months: ["2026-11", …] } (newest first)
// The months with payments or refunds (not voided), in the clinic's time zone
export const listArchive = async (req: Request, res: Response) => {
  const timeZone = await loadTimezone(req.clinicId!);
  const rows = await db.execute<{ month: string }>(sql`
    select distinct to_char(${payment.paidAt} at time zone ${timeZone}, 'YYYY-MM') as month
    from ${payment}
    where ${payment.organizationId} = ${req.clinicId!} and ${payment.voidedAt} is null
    order by month desc`);
  res.json({ months: rows.rows.map((r) => r.month) });
};

// GET /clinic/charges/export?month=YYYY-MM -> text/csv (download)
// The month's payments and refunds for the accountant (lib/chargesExport.ts).
// Owners and admins: it has patients' NIF and address and the clinic's income
export const exportMonth = async (req: Request, res: Response) => {
  const { month } = req.query;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return badRequest(res, "INVALID_MONTH", "month debe tener el formato AAAA-MM");
  }
  const { csv } = await buildMonthCsv(req.clinicId!, month);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cobros-${month}.csv"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(csv);
};
