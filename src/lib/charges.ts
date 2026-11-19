import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  bono,
  clinicChargeSettings,
  clinicFeature,
  patient,
  payment,
  service,
  sessionCharge,
  user,
} from "../db/schema.js";
import type { ClinicRole } from "./permissions.js";
import { bonoCoverage } from "./bonos.js";
import { loadTimezone } from "./clinicSchedule.js";
import { addDaysIso, utcToZoned, zonedToUtc } from "./timezone.js";

// Cobros y bonos (COBROS.md), "invoicing" feature. Not invoices: the clinic's
// own record of what its patients pay.

// Who works with charges: they record payments and sell bonos. Physios only
// see whether their own sessions are paid (on the appointment, later)
export const CHARGE_ROLES = ["owner", "admin", "receptionist"] as const satisfies readonly ClinicRole[];
// Who changes the settings and sees income reports
export const CHARGE_MANAGER_ROLES = ["owner", "admin"] as const satisfies readonly ClinicRole[];

export type ChargeSettings = {
  // "YYYY-MM-DD" in the clinic's time zone: sessions before it never show as
  // pending
  startsOn: string;
  // No-shows are charged (and use up a bono session)
  chargeNoShows: boolean;
};

// The clinic's settings. Without a saved row: counting starts the day the
// super-admin switched the feature on (today if it isn't on)
export async function getChargeSettings(clinicId: string): Promise<ChargeSettings> {
  const [saved] = await db
    .select({
      startsOn: clinicChargeSettings.startsOn,
      chargeNoShows: clinicChargeSettings.chargeNoShows,
    })
    .from(clinicChargeSettings)
    .where(eq(clinicChargeSettings.organizationId, clinicId))
    .limit(1);
  if (saved) return saved;

  const [feature] = await db
    .select({ enabledAt: clinicFeature.enabledAt })
    .from(clinicFeature)
    .where(and(eq(clinicFeature.organizationId, clinicId), eq(clinicFeature.feature, "invoicing")))
    .limit(1);
  const timeZone = await loadTimezone(clinicId);
  return {
    startsOn: utcToZoned(feature?.enabledAt ?? new Date(), timeZone).date,
    chargeNoShows: false,
  };
}

// A real calendar date "YYYY-MM-DD" (not 2026-02-30)
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

// Body of PUT /clinic/charges/settings -> the settings, or an error message
export function parseChargeSettings(body: Record<string, unknown>): ChargeSettings | string {
  const { startsOn, chargeNoShows } = body;
  if (!isIsoDate(startsOn) || startsOn < "2000-01-01") {
    return "startsOn debe ser una fecha AAAA-MM-DD";
  }
  if (typeof chargeNoShows !== "boolean") return "chargeNoShows debe ser true o false";
  return { startsOn, chargeNoShows };
}

// ── Sessions (registro de sesiones) ──────────────────────────────────────

// One patient in one appointment (a group session has one per patient).
// Where it stands for charging:
// - upcoming: hasn't happened yet
// - to_confirm: already started but the appointment isn't marked as done or
//   as a no-show. It counts once someone confirms it (charging it does)
// - pending: done (or a no-show the clinic charges) and not paid yet
// - free: done, and its service costs 0 €
// - no_charge: a no-show, and the clinic doesn't charge them
// - paid: has a payment
// - bono: paid with a bono (one of its sessions)
// - waived: the clinic decided not to charge it (with a reason)
// - review: has a payment, but its appointment was cancelled or deleted, or
//   the patient left it. The payment has to be moved to another session or
//   refunded
// Cancelled appointments only appear when they left a payment behind (review)
export type SessionState =
  | "upcoming"
  | "to_confirm"
  | "pending"
  | "free"
  | "no_charge"
  | "paid"
  | "bono"
  | "waived"
  | "review";

export const PAYMENT_METHODS = ["cash", "card", "bizum", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ChargeSession = {
  // Stable key, and how the API refers to the session: the appointment_patient
  // id, or the session_charge id for manual sessions and for paid ones whose
  // patient is no longer in the appointment
  id: string;
  // "calendar": from an appointment · "manual": recorded in Cobros (not in the calendar)
  source: "calendar" | "manual";
  // Manual sessions: why it isn't in the calendar
  note: string | null;
  appointmentPatientId: string | null;
  chargeId: string | null; // its session_charge row, if it has one
  appointmentId: string | null;
  startsAt: Date;
  patientId: string | null; // null: no ficha
  firstName: string;
  lastName: string;
  serviceId: string | null; // null: the service was deleted (its name stays)
  serviceName: string;
  serviceColor: string;
  isGroup: boolean;
  physioId: string | null;
  physioName: string | null;
  // Frozen on the session once it's charged or edited; the service's price
  // today until then
  priceCents: number;
  priceChanged: boolean; // differs from the service's price today
  appointmentStatus: "booked" | "confirmed" | "completed" | "no_show" | "cancelled" | null;
  attendance: "pending" | "attended" | "no_show" | null;
  state: SessionState;
  waivedReason: string | null;
  // Paid with a bono: which one
  bono: { id: string; name: string } | null;
  // Paid with a bono that no longer covers it (the appointment changed after):
  // why. Its state is then "review": take it off the bono
  bonoProblem: string | null;
  payment: {
    id: string;
    method: PaymentMethod;
    paidAt: Date;
    amountCents: number;
    sessionCount: number; // sessions it pays (one payment can cover several)
  } | null;
};

// What happened to one patient: their own attendance when someone marked it
// (group sessions), otherwise the appointment's status
export function outcome(status: string, attendance: string): "came" | "no_show" | "unknown" {
  if (attendance === "attended") return "came";
  if (attendance === "no_show") return "no_show";
  if (status === "completed") return "came";
  if (status === "no_show") return "no_show";
  return "unknown";
}

// Where a session of the calendar stands, before looking at payments
export function sessionState(
  s: { startsAt: Date; appointmentStatus: string; attendance: string; priceCents: number },
  settings: ChargeSettings,
  now: Date,
): Exclude<SessionState, "paid" | "bono" | "waived" | "review"> {
  const result = outcome(s.appointmentStatus, s.attendance);
  if (result === "came") return s.priceCents > 0 ? "pending" : "free";
  if (result === "no_show") {
    return settings.chargeNoShows && s.priceCents > 0 ? "pending" : "no_charge";
  }
  return s.startsAt > now ? "upcoming" : "to_confirm";
}

// The day range in UTC: from `from` at 00:00 to the day after `to` at 00:00
async function utcRange(clinicId: string, from: string, to: string) {
  const timeZone = await loadTimezone(clinicId);
  return {
    start: zonedToUtc(from, "00:00", timeZone),
    end: zonedToUtc(addDaysIso(to, 1), "00:00", timeZone),
  };
}

// Sessions per payment, for "pays 3 sessions"
async function sessionCounts(clinicId: string, paymentIds: string[]) {
  if (paymentIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ paymentId: sessionCharge.paymentId, count: sql<number>`count(*)::int` })
    .from(sessionCharge)
    .where(
      and(eq(sessionCharge.organizationId, clinicId), inArray(sessionCharge.paymentId, paymentIds)),
    )
    .groupBy(sessionCharge.paymentId);
  return new Map(rows.map((r) => [r.paymentId!, r.count]));
}

// The sessions of a range of days ("YYYY-MM-DD", both included, in the
// clinic's time zone), oldest first. Days before the clinic's startsOn are
// left out, except sessions already paid (with a payment or a bono) or waived:
// an appointment moved there after being paid keeps showing, with its money
export async function loadSessions(
  clinicId: string,
  range: { from: string; to: string },
  settings: ChargeSettings,
  now = new Date(),
): Promise<ChargeSession[]> {
  if (range.from > range.to) return [];
  const { start, end } = await utcRange(clinicId, range.from, range.to);
  const countsFrom = zonedToUtc(settings.startsOn, "00:00", await loadTimezone(clinicId));

  const paymentColumns = {
    paymentId: payment.id,
    paymentMethod: payment.method,
    paymentPaidAt: payment.paidAt,
    paymentAmount: payment.amountCents,
  };

  // Every patient of every appointment of those days, with its charge row
  const calendar = await db
    .select({
      appointmentPatientId: appointmentPatient.id,
      chargeId: sessionCharge.id,
      appointmentId: appointment.id,
      startsAt: appointment.startsAt,
      patientId: appointmentPatient.patientId,
      // The ficha's current name; the copy on the appointment if there's none
      firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName})`,
      lastName: sql<string>`coalesce(${patient.lastName}, ${appointmentPatient.lastName})`,
      serviceId: service.id,
      serviceName: service.name,
      serviceColor: service.color,
      isGroup: service.isGroup,
      servicePrice: service.priceCents,
      physioId: user.id,
      physioName: user.name,
      frozenPrice: sessionCharge.priceCents,
      waivedReason: sessionCharge.waivedReason,
      bonoId: sessionCharge.bonoId,
      bonoName: bono.name,
      appointmentStatus: appointment.status,
      attendance: appointmentPatient.attendance,
      ...paymentColumns,
    })
    .from(appointmentPatient)
    .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .leftJoin(user, eq(appointment.physioId, user.id))
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
    .leftJoin(
      sessionCharge,
      and(
        eq(sessionCharge.appointmentPatientId, appointmentPatient.id),
        eq(sessionCharge.organizationId, clinicId),
      ),
    )
    .leftJoin(payment, eq(sessionCharge.paymentId, payment.id))
    .leftJoin(bono, eq(sessionCharge.bonoId, bono.id))
    .where(
      and(
        // Always filtered by clinic: patients' names are personal data
        eq(appointmentPatient.organizationId, clinicId),
        eq(appointment.organizationId, clinicId),
        gte(appointment.startsAt, start),
        lt(appointment.startsAt, end),
        // Cancelled ones only if they kept a payment (review)
        or(ne(appointment.status, "cancelled"), isNotNull(sessionCharge.paymentId)),
      ),
    )
    .orderBy(asc(appointment.startsAt), asc(appointmentPatient.createdAt));

  // Paid sessions whose patient left the appointment, or whose appointment was
  // deleted: the charge row is all that's left (review)
  const orphans = await db
    .select({
      chargeId: sessionCharge.id,
      startsAt: sessionCharge.occurredAt,
      patientId: sessionCharge.patientId,
      firstName: sessionCharge.firstName,
      lastName: sessionCharge.lastName,
      serviceId: sessionCharge.serviceId,
      serviceName: sql<string>`coalesce(${service.name}, ${sessionCharge.serviceName}, 'Servicio eliminado')`,
      serviceColor: sql<string>`coalesce(${service.color}, '#9CA3AF')`,
      isGroup: sql<boolean>`coalesce(${service.isGroup}, false)`,
      servicePrice: sql<number | null>`${service.priceCents}`,
      physioId: sessionCharge.physioId,
      physioName: user.name,
      frozenPrice: sessionCharge.priceCents,
      ...paymentColumns,
    })
    .from(sessionCharge)
    .leftJoin(service, eq(sessionCharge.serviceId, service.id))
    .innerJoin(payment, eq(sessionCharge.paymentId, payment.id))
    .leftJoin(user, eq(sessionCharge.physioId, user.id))
    .where(
      and(
        eq(sessionCharge.organizationId, clinicId),
        eq(sessionCharge.source, "calendar"),
        isNull(sessionCharge.appointmentPatientId),
        gte(sessionCharge.occurredAt, start),
        lt(sessionCharge.occurredAt, end),
      ),
    );

  // Sessions recorded in Cobros, not in the calendar. Cancelled ones only if
  // they kept a payment (review)
  const manual = await db
    .select({
      chargeId: sessionCharge.id,
      startsAt: sessionCharge.occurredAt,
      patientId: sessionCharge.patientId,
      firstName: sql<string>`coalesce(${patient.firstName}, ${sessionCharge.firstName})`,
      lastName: sql<string>`coalesce(${patient.lastName}, ${sessionCharge.lastName})`,
      serviceId: sessionCharge.serviceId,
      serviceName: sql<string>`coalesce(${service.name}, ${sessionCharge.serviceName}, 'Servicio eliminado')`,
      serviceColor: sql<string>`coalesce(${service.color}, '#9CA3AF')`,
      servicePrice: sql<number | null>`${service.priceCents}`,
      physioId: sessionCharge.physioId,
      physioName: user.name,
      frozenPrice: sessionCharge.priceCents,
      waivedReason: sessionCharge.waivedReason,
      note: sessionCharge.note,
      cancelledAt: sessionCharge.cancelledAt,
      bonoId: sessionCharge.bonoId,
      bonoName: bono.name,
      ...paymentColumns,
    })
    .from(sessionCharge)
    .leftJoin(service, eq(sessionCharge.serviceId, service.id))
    .leftJoin(payment, eq(sessionCharge.paymentId, payment.id))
    .leftJoin(user, eq(sessionCharge.physioId, user.id))
    .leftJoin(patient, eq(sessionCharge.patientId, patient.id))
    .leftJoin(bono, eq(sessionCharge.bonoId, bono.id))
    .where(
      and(
        eq(sessionCharge.organizationId, clinicId),
        eq(sessionCharge.source, "manual"),
        gte(sessionCharge.occurredAt, start),
        lt(sessionCharge.occurredAt, end),
        or(isNull(sessionCharge.cancelledAt), isNotNull(sessionCharge.paymentId)),
      ),
    );

  const counts = await sessionCounts(
    clinicId,
    [...calendar, ...orphans, ...manual].flatMap((r) => (r.paymentId ? [r.paymentId] : [])),
  );
  const paymentOf = (
    r: (typeof calendar)[number] | (typeof orphans)[number] | (typeof manual)[number],
  ) =>
    r.paymentId
      ? {
          id: r.paymentId,
          method: r.paymentMethod as PaymentMethod,
          paidAt: r.paymentPaidAt!,
          amountCents: r.paymentAmount!,
          sessionCount: counts.get(r.paymentId) ?? 1,
        }
      : null;

  const sessions: ChargeSession[] = calendar.map((r) => {
    const priceCents = r.frozenPrice ?? r.servicePrice;
    const base = sessionState(
      { startsAt: r.startsAt, appointmentStatus: r.appointmentStatus, attendance: r.attendance, priceCents },
      settings,
      now,
    );
    const state: SessionState =
      r.appointmentStatus === "cancelled"
        ? "review"
        : r.paymentId
          ? "paid"
          : r.bonoId
            ? "bono"
            : r.waivedReason
              ? "waived"
              : base;
    return {
      id: r.appointmentPatientId,
      source: "calendar" as const,
      note: null,
      appointmentPatientId: r.appointmentPatientId,
      chargeId: r.chargeId,
      appointmentId: r.appointmentId,
      startsAt: r.startsAt,
      patientId: r.patientId,
      firstName: r.firstName,
      lastName: r.lastName,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      serviceColor: r.serviceColor,
      isGroup: r.isGroup,
      physioId: r.physioId,
      physioName: r.physioName,
      priceCents,
      priceChanged: priceCents !== r.servicePrice,
      appointmentStatus: r.appointmentStatus,
      attendance: r.attendance,
      state,
      waivedReason: r.waivedReason,
      bono: r.bonoId ? { id: r.bonoId, name: r.bonoName ?? "Bono" } : null,
      bonoProblem: null,
      payment: paymentOf(r),
    };
  });

  for (const r of orphans) {
    sessions.push({
      id: r.chargeId,
      source: "calendar",
      note: null,
      appointmentPatientId: null,
      chargeId: r.chargeId,
      appointmentId: null,
      startsAt: r.startsAt,
      patientId: r.patientId,
      firstName: r.firstName,
      lastName: r.lastName,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      serviceColor: r.serviceColor,
      isGroup: r.isGroup,
      physioId: r.physioId,
      physioName: r.physioName,
      priceCents: r.frozenPrice,
      priceChanged: r.servicePrice !== null && r.frozenPrice !== r.servicePrice,
      appointmentStatus: null,
      attendance: null,
      state: "review",
      waivedReason: null,
      bono: null,
      bonoProblem: null,
      payment: paymentOf(r),
    });
  }

  for (const r of manual) {
    const state: SessionState = r.cancelledAt
      ? "review"
      : r.paymentId
        ? "paid"
        : r.bonoId
          ? "bono"
          : r.waivedReason
            ? "waived"
            : r.frozenPrice > 0
            ? "pending"
            : "free";
    sessions.push({
      id: r.chargeId,
      source: "manual",
      note: r.note,
      appointmentPatientId: null,
      chargeId: r.chargeId,
      appointmentId: null,
      startsAt: r.startsAt,
      patientId: r.patientId,
      firstName: r.firstName,
      lastName: r.lastName,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      serviceColor: r.serviceColor,
      isGroup: false,
      physioId: r.physioId,
      physioName: r.physioName,
      priceCents: r.frozenPrice,
      priceChanged: r.servicePrice !== null && r.frozenPrice !== r.servicePrice,
      appointmentStatus: null,
      attendance: null,
      state,
      waivedReason: r.waivedReason,
      bono: r.bonoId ? { id: r.bonoId, name: r.bonoName ?? "Bono" } : null,
      bonoProblem: null,
      payment: paymentOf(r),
    });
  }

  // Sessions paid with a bono, checked again against it
  const withBono = sessions.filter((s) => s.state === "bono");
  if (withBono.length > 0) {
    const { problems } = await bonoCoverage(db, clinicId, [...new Set(withBono.map((s) => s.bono!.id))]);
    for (const s of withBono) {
      const problem = problems.get(s.chargeId!);
      if (problem) {
        s.state = "review";
        s.bonoProblem = problem;
      }
    }
  }

  return sessions
    .filter((s) => s.startsAt >= countsFrom || s.payment || s.bono || s.waivedReason)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// The day ("YYYY-MM-DD", clinic time) of the earliest session paid (with a
// payment or a bono), or null. The start date can't move past it
export async function firstPaidSessionDay(clinicId: string): Promise<string | null> {
  const [row] = await db
    .select({
      first: sql<Date | null>`min(coalesce(${appointment.startsAt}, ${sessionCharge.occurredAt}))`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
    })
    .from(sessionCharge)
    .leftJoin(appointmentPatient, eq(sessionCharge.appointmentPatientId, appointmentPatient.id))
    .leftJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
    .where(
      and(
        eq(sessionCharge.organizationId, clinicId),
        or(isNotNull(sessionCharge.paymentId), isNotNull(sessionCharge.bonoId)),
      ),
    );
  if (!row?.first) return null;
  return utcToZoned(row.first, await loadTimezone(clinicId)).date;
}
