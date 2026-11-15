import type { Request, Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicBilling, clinicPayment, organization, user } from "../db/schema.js";
import { utcToZoned } from "../lib/timezone.js";

// Pagos (super-admin only, checked in billing.routes.ts). Manual tracking of
// whether each clinic has paid each month. Months are "YYYY-MM" in Spain's
// time zone: a clinic created on 31 Oct at 23:30 in Madrid starts in October.
const PLATFORM_TIME_ZONE = "Europe/Madrid";

// How many months of history each clinic brings (the selected one included)
const HISTORY_MONTHS = 12;

const isMonth = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const monthOf = (date: Date) => utcToZoned(date, PLATFORM_TIME_ZONE).date.slice(0, 7);

// "2026-11", -1 -> "2026-10"
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

// GET /admin/billing?month=YYYY-MM (default: this month)
// Every clinic with its state for that month and the months before it:
// - startMonth: the month it was created (earlier months aren't owed)
// - exempt: "no tiene que pagar"
// - payment: when that month was marked as paid, and by whom (null = not paid)
// - paidMonths: the paid months among the last 12 (for the history strip)
export const getBilling = async (req: Request, res: Response) => {
  const currentMonth = monthOf(new Date());
  const { month: requested } = req.query;
  if (requested !== undefined && !isMonth(requested)) {
    return send(res, 400, "INVALID_MONTH", "month debe tener el formato AAAA-MM");
  }
  const month = requested ?? currentMonth;
  const window = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
    shiftMonth(month, i - HISTORY_MONTHS + 1),
  );

  const [clinics, payments] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        status: organization.status,
        createdAt: organization.createdAt,
        exempt: clinicBilling.exempt,
      })
      .from(organization)
      .leftJoin(clinicBilling, eq(clinicBilling.organizationId, organization.id))
      .orderBy(asc(organization.name)),
    db
      .select({
        organizationId: clinicPayment.organizationId,
        month: clinicPayment.month,
        paidAt: clinicPayment.paidAt,
        recordedByName: user.name,
      })
      .from(clinicPayment)
      .leftJoin(user, eq(clinicPayment.recordedBy, user.id))
      .where(inArray(clinicPayment.month, window)),
  ]);

  res.json({
    month,
    currentMonth,
    clinics: clinics.map(({ createdAt, exempt, ...clinic }) => {
      const own = payments.filter((p) => p.organizationId === clinic.id);
      const payment = own.find((p) => p.month === month);
      return {
        ...clinic,
        startMonth: monthOf(createdAt),
        exempt: exempt ?? false,
        payment: payment
          ? { paidAt: payment.paidAt, recordedByName: payment.recordedByName }
          : null,
        paidMonths: own.map((p) => p.month).sort(),
      };
    }),
  });
};

type ClinicParams = { clinicId: string };
type PaymentParams = ClinicParams & { month: string };

// The clinic's creation month, or null after sending a 404
async function findClinicStart(req: Request<ClinicParams>, res: Response) {
  const [clinic] = await db
    .select({ createdAt: organization.createdAt })
    .from(organization)
    .where(eq(organization.id, req.params.clinicId))
    .limit(1);
  if (!clinic) {
    send(res, 404, "CLINIC_NOT_FOUND", "Esta clínica no existe");
    return null;
  }
  return monthOf(clinic.createdAt);
}

// Payments only for months the clinic existed in, up to this month
async function checkPaymentMonth(req: Request<PaymentParams>, res: Response) {
  const { month } = req.params;
  if (!isMonth(month)) {
    send(res, 400, "INVALID_MONTH", "El mes debe tener el formato AAAA-MM");
    return false;
  }
  const startMonth = await findClinicStart(req, res);
  if (!startMonth) return false;
  if (month < startMonth || month > monthOf(new Date())) {
    send(res, 400, "MONTH_OUT_OF_RANGE", "Ese mes no se puede marcar para esta clínica");
    return false;
  }
  return true;
}

// PUT /admin/billing/:clinicId/payments/:month -> 204 (marking twice changes nothing)
export const markPaid = async (req: Request<PaymentParams>, res: Response) => {
  if (!(await checkPaymentMonth(req, res))) return;
  await db
    .insert(clinicPayment)
    .values({
      organizationId: req.params.clinicId,
      month: req.params.month,
      recordedBy: req.user!.id,
    })
    .onConflictDoNothing();
  res.status(204).end();
};

// DELETE /admin/billing/:clinicId/payments/:month -> 204 (back to pending)
export const unmarkPaid = async (req: Request<PaymentParams>, res: Response) => {
  if (!(await checkPaymentMonth(req, res))) return;
  await db
    .delete(clinicPayment)
    .where(
      and(
        eq(clinicPayment.organizationId, req.params.clinicId),
        eq(clinicPayment.month, req.params.month),
      ),
    );
  res.status(204).end();
};

// PUT /admin/billing/:clinicId/exempt   body: { exempt: boolean } -> 204
// Payments already recorded are kept either way
export const setExempt = async (req: Request<ClinicParams>, res: Response) => {
  const { exempt } = req.body ?? {};
  if (typeof exempt !== "boolean") {
    return send(res, 400, "INVALID_EXEMPT", "exempt debe ser true o false");
  }
  if (!(await findClinicStart(req, res))) return;
  await db
    .insert(clinicBilling)
    .values({ organizationId: req.params.clinicId, exempt })
    .onConflictDoUpdate({ target: clinicBilling.organizationId, set: { exempt } });
  res.status(204).end();
};
