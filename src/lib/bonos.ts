import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  bono,
  bonoType,
  patient,
  payment,
  service,
  sessionCharge,
} from "../db/schema.js";
import { getChargeSettings, outcome, sessionState, type PaymentMethod } from "./charges.js";
import { loadTimezone } from "./clinicSchedule.js";
import {
  type Actor,
  assertAfterStart,
  ChargeError,
  confirmSession,
  isManager,
  loadTargetSessions,
  lockChargeRows,
  logEvent,
  resolvePaidAt,
  type TargetSession,
  type Tx,
} from "./payments.js";
import { addDaysIso, isoWeekdayOf, utcToZoned, zonedToUtc } from "./timezone.js";

// Bonos (COBROS.md, H4–H7), part of the "invoicing" feature (Cobros y bonos).
// H4: the bono types each clinic sells.

export type BonoKind = "sessions" | "monthly";

export type BonoTypeInput = {
  name: string;
  serviceId: string;
  kind: BonoKind;
  sessions: number | null; // "sessions": how many (1–200)
  validityDays: number | null; // "sessions": days it lasts once sold; null = forever
  sessionsPerWeek: number | null; // "monthly": limit per week (1–14); null = none
  priceCents: number;
  isActive: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

// Body of POST/PUT bono-types -> the input, or what's wrong (in Spanish)
export function parseBonoType(body: Record<string, unknown>): BonoTypeInput | string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) return "El nombre es obligatorio (máximo 80 caracteres)";
  if (typeof body.serviceId !== "string" || !UUID.test(body.serviceId)) return "Elige un servicio";
  if (body.kind !== "sessions" && body.kind !== "monthly") return "Elige si es de sesiones o mensual";
  if (!int(body.priceCents, 1, 10_000_00)) return "El precio tiene que ser mayor que 0";
  const isActive = body.isActive === undefined ? true : body.isActive;
  if (typeof isActive !== "boolean") return "isActive debe ser true o false";

  if (body.kind === "sessions") {
    if (!int(body.sessions, 1, 200)) return "El número de sesiones tiene que estar entre 1 y 200";
    const validityDays = body.validityDays ?? null;
    if (validityDays !== null && !int(validityDays, 1, 1095)) {
      return "La caducidad tiene que estar entre 1 y 1095 días, o sin caducidad";
    }
    return {
      name,
      serviceId: body.serviceId,
      kind: "sessions",
      sessions: body.sessions as number,
      validityDays: validityDays as number | null,
      sessionsPerWeek: null,
      priceCents: body.priceCents as number,
      isActive,
    };
  }
  const sessionsPerWeek = body.sessionsPerWeek ?? null;
  if (sessionsPerWeek !== null && !int(sessionsPerWeek, 1, 14)) {
    return "Las sesiones por semana tienen que estar entre 1 y 14, o sin límite";
  }
  return {
    name,
    serviceId: body.serviceId,
    kind: "monthly",
    sessions: null,
    validityDays: null,
    sessionsPerWeek: sessionsPerWeek as number | null,
    priceCents: body.priceCents as number,
    isActive,
  };
}

// The clinic's bono types, active first, by name. serviceName: the service's
// name today, or the copy if it was deleted. servicePriceCents: to show what a
// session costs without the bono (null if the service is gone)
export async function listBonoTypes(clinicId: string) {
  const rows = await db
    .select({
      type: bonoType,
      currentName: service.name,
      servicePriceCents: service.priceCents,
      serviceActive: service.isActive,
    })
    .from(bonoType)
    .leftJoin(service, eq(bonoType.serviceId, service.id))
    .where(eq(bonoType.organizationId, clinicId))
    .orderBy(desc(bonoType.isActive), asc(bonoType.name));
  return rows.map(({ type, currentName, servicePriceCents, serviceActive }) => ({
    id: type.id,
    name: type.name,
    serviceId: type.serviceId,
    serviceName: currentName ?? type.serviceName,
    servicePriceCents,
    // Can be sold: active, with its service still there and active
    sellable: type.isActive && !!type.serviceId && !!serviceActive,
    kind: type.kind as BonoKind,
    sessions: type.sessions,
    validityDays: type.validityDays,
    sessionsPerWeek: type.sessionsPerWeek,
    priceCents: type.priceCents,
    isActive: type.isActive,
  }));
}

// The service, if it's this clinic's
export async function clinicService(clinicId: string, serviceId: string) {
  const [found] = await db
    .select({ id: service.id, name: service.name, isActive: service.isActive })
    .from(service)
    .where(and(eq(service.id, serviceId), eq(service.organizationId, clinicId)));
  return found ?? null;
}

// ── H5: selling bonos ────────────────────────────────────────────────────

export type BonoHolder =
  | { patientId: string }
  | { firstName: string; lastName: string; contact: string };

export type SellBonoInput = {
  patient: BonoHolder;
  // From a type the clinic sells…
  bonoTypeId?: string;
  // …or made to measure (same fields as a type)
  custom?: BonoTypeInput;
  // "sessions": first day it's valid ("YYYY-MM-DD"). Missing: today
  validFrom?: string;
  // "monthly": which month ("YYYY-MM"). Missing: this month
  month?: string;
  priceCents?: number; // missing: the type's price
  note: string | null;
  // Paid now (a payment), or null: pending, it can be used anyway
  pay: { method: PaymentMethod; paidOn?: string; note: string | null } | null;
};

// "2026-11" -> "2026-11-30"
function lastDayOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m!, 0));
  return `${month}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function insertBonoPayment(
  tx: Tx,
  actor: Actor,
  sold: { id: string; priceCents: number; patientId: string | null; firstName: string; lastName: string },
  pay: { method: PaymentMethod; note: string | null },
  paidAt: Date,
) {
  const [created] = await tx
    .insert(payment)
    .values({
      organizationId: actor.clinicId,
      kind: "bono",
      bonoId: sold.id,
      amountCents: sold.priceCents,
      method: pay.method,
      paidAt,
      patientId: sold.patientId,
      firstName: sold.firstName,
      lastName: sold.lastName,
      note: pay.note,
      recordedBy: actor.userId,
    })
    .returning();
  await logEvent(tx, actor, "payment", created!.id, "paid", {
    amountCents: sold.priceCents,
    method: pay.method,
    bonoId: sold.id,
  });
  return created!;
}

export async function sellBono(actor: Actor, input: SellBonoInput, now = new Date()) {
  const settings = await getChargeSettings(actor.clinicId);
  const timeZone = await loadTimezone(actor.clinicId);
  const today = utcToZoned(now, timeZone).date;
  const paidAt = input.pay ? await resolvePaidAt(actor.clinicId, input.pay.paidOn, now) : null;

  // What is sold: a sellable type of the clinic, or a bono made to measure
  let shape: BonoTypeInput & { bonoTypeId: string | null; serviceName: string };
  if (input.bonoTypeId) {
    const types = await listBonoTypes(actor.clinicId);
    const type = types.find((t) => t.id === input.bonoTypeId);
    if (!type) throw new ChargeError(404, "BONO_TYPE_NOT_FOUND", "Ese tipo de bono no existe");
    if (!type.sellable) {
      throw new ChargeError(409, "NOT_SELLABLE", "Ese bono está desactivado o su servicio ya no está disponible");
    }
    shape = { ...type, serviceId: type.serviceId!, bonoTypeId: type.id, isActive: true };
  } else if (input.custom) {
    const svc = await clinicService(actor.clinicId, input.custom.serviceId);
    if (!svc || !svc.isActive) {
      throw new ChargeError(400, "INVALID_SERVICE", "El servicio no existe o está desactivado");
    }
    shape = { ...input.custom, bonoTypeId: null, serviceName: svc.name };
  } else {
    throw new ChargeError(400, "INVALID_BONO", "Elige un tipo de bono");
  }

  // When it's valid
  let validFrom: string;
  let validUntil: string | null;
  if (shape.kind === "monthly") {
    const month = input.month ?? today.slice(0, 7);
    validFrom = `${month}-01`;
    validUntil = lastDayOf(month);
  } else {
    validFrom = input.validFrom ?? today;
    validUntil = shape.validityDays ? addDaysIso(validFrom, shape.validityDays - 1) : null;
  }
  if ((validUntil ?? "9999-12-31") < settings.startsOn) {
    throw new ChargeError(409, "BEFORE_START", "El bono es anterior a la fecha de inicio de los cobros");
  }

  // Who it's for
  let holder: { patientId: string | null; firstName: string; lastName: string; contact: string | null };
  if ("patientId" in input.patient) {
    const [ficha] = await db
      .select({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })
      .from(patient)
      .where(and(eq(patient.id, input.patient.patientId), eq(patient.organizationId, actor.clinicId)));
    if (!ficha) throw new ChargeError(404, "PATIENT_NOT_FOUND", "El paciente no existe en tu clínica");
    holder = { patientId: ficha.id, firstName: ficha.firstName, lastName: ficha.lastName, contact: null };
  } else {
    holder = { patientId: null, ...input.patient };
  }

  return db.transaction(async (tx) => {
    const [sold] = await tx
      .insert(bono)
      .values({
        organizationId: actor.clinicId,
        bonoTypeId: shape.bonoTypeId,
        name: shape.name,
        kind: shape.kind,
        serviceId: shape.serviceId,
        serviceName: shape.serviceName,
        ...holder,
        totalSessions: shape.kind === "sessions" ? shape.sessions : null,
        sessionsPerWeek: shape.kind === "monthly" ? shape.sessionsPerWeek : null,
        validFrom,
        validUntil,
        priceCents: input.priceCents ?? shape.priceCents,
        note: input.note,
        createdBy: actor.userId,
      })
      .returning();
    await logEvent(tx, actor, "bono", sold!.id, "sold", { priceCents: sold!.priceCents });
    if (input.pay) await insertBonoPayment(tx, actor, sold!, input.pay, paidAt!);
    return sold!;
  });
}

// The bono's payment that counts (not voided), if it has one
async function activeBonoPayment(tx: Tx, clinicId: string, bonoId: string) {
  const [found] = await tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.organizationId, clinicId),
        eq(payment.bonoId, bonoId),
        eq(payment.kind, "bono"),
        isNull(payment.voidedAt),
      ),
    )
    .limit(1);
  return found ?? null;
}

async function lockBono(tx: Tx, clinicId: string, bonoId: string) {
  const [found] = await tx
    .select()
    .from(bono)
    .where(and(eq(bono.id, bonoId), eq(bono.organizationId, clinicId)))
    .for("update");
  if (!found) throw new ChargeError(404, "BONO_NOT_FOUND", "El bono no existe en tu clínica");
  return found;
}

// Charges a bono sold as pending
export async function payBono(
  actor: Actor,
  bonoId: string,
  pay: { method: PaymentMethod; paidOn?: string; note: string | null },
  now = new Date(),
) {
  const paidAt = await resolvePaidAt(actor.clinicId, pay.paidOn, now);
  return db.transaction(async (tx) => {
    const found = await lockBono(tx, actor.clinicId, bonoId);
    if (found.cancelledAt) throw new ChargeError(409, "BONO_CANCELLED", "El bono está anulado");
    if (await activeBonoPayment(tx, actor.clinicId, bonoId)) {
      throw new ChargeError(409, "ALREADY_PAID", "El bono ya está cobrado");
    }
    return insertBonoPayment(tx, actor, found, pay, paidAt);
  });
}

// Cancels a bono (sold by mistake, the patient leaves…). If it was paid, part
// or all of the money can go back to the patient today (a refund of its
// payment): owners and admins always, reception only for payments it recorded
export async function cancelBono(
  actor: Actor,
  bonoId: string,
  input: { reason: string; refund: { amountCents: number; method: PaymentMethod } | null },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const found = await lockBono(tx, actor.clinicId, bonoId);
    if (found.cancelledAt) throw new ChargeError(409, "BONO_CANCELLED", "El bono ya está anulado");
    await tx
      .update(bono)
      .set({ cancelledAt: now, cancelledBy: actor.userId, cancelReason: input.reason })
      .where(eq(bono.id, found.id));

    let refundId: string | null = null;
    if (input.refund) {
      const paid = await activeBonoPayment(tx, actor.clinicId, bonoId);
      if (!paid) throw new ChargeError(409, "NOT_PAID", "El bono no está cobrado: no hay nada que devolver");
      if (!isManager(actor.role) && paid.recordedBy !== actor.userId) {
        throw new ChargeError(
          403,
          "REFUND_NOT_ALLOWED",
          "Solo puedes devolver los cobros que registraste tú. Pídeselo a un administrador",
        );
      }
      if (input.refund.amountCents > paid.amountCents) {
        throw new ChargeError(400, "REFUND_TOO_HIGH", "No se puede devolver más de lo que se cobró");
      }
      const [refund] = await tx
        .insert(payment)
        .values({
          organizationId: actor.clinicId,
          kind: "refund",
          amountCents: -input.refund.amountCents,
          method: input.refund.method,
          paidAt: now,
          patientId: paid.patientId,
          firstName: paid.firstName,
          lastName: paid.lastName,
          note: `Anulación del bono: ${input.reason}`,
          refundOfId: paid.id,
          recordedBy: actor.userId,
        })
        .returning();
      refundId = refund!.id;
      await logEvent(tx, actor, "payment", paid.id, "refunded", {
        refundId,
        amountCents: input.refund.amountCents,
        method: input.refund.method,
        bonoId,
        sessions: [],
        partial: input.refund.amountCents < paid.amountCents,
      });
    }
    await logEvent(tx, actor, "bono", found.id, "cancelled", { reason: input.reason, refundId });
  });
}

// ── Listing bonos ────────────────────────────────────────────────────────

// - active: can be used now · upcoming: starts later · expired: past its last
//   day · used_up: no sessions left (H6) · cancelled
export type BonoStatus = "active" | "upcoming" | "expired" | "used_up" | "cancelled";

export async function listBonos(
  clinicId: string,
  filter: { bonoIds?: string[]; patientId?: string } = {},
  now = new Date(),
) {
  const today = utcToZoned(now, await loadTimezone(clinicId)).date;
  const rows = await db
    .select({
      bono,
      currentPatientFirst: patient.firstName,
      currentPatientLast: patient.lastName,
      paymentId: payment.id,
      paymentMethod: payment.method,
      paymentPaidAt: payment.paidAt,
      paymentRecordedBy: payment.recordedBy,
      refundedCents: sql<number>`(select coalesce(-sum(r.amount_cents), 0)::int from ${payment} r where r.refund_of_id = ${payment.id})`,
    })
    .from(bono)
    .leftJoin(patient, eq(bono.patientId, patient.id))
    .leftJoin(
      payment,
      and(eq(payment.bonoId, bono.id), eq(payment.kind, "bono"), isNull(payment.voidedAt)),
    )
    .where(
      and(
        eq(bono.organizationId, clinicId),
        filter.bonoIds ? inArray(bono.id, filter.bonoIds) : undefined,
        filter.patientId ? eq(bono.patientId, filter.patientId) : undefined,
      ),
    )
    .orderBy(desc(bono.createdAt));

  const usage = await bonoUsage(db, clinicId, rows.map((r) => r.bono.id));
  const thisWeek = mondayOf(today);
  return rows.map((r) => {
    const b = r.bono;
    const sessionsUsed = usage.get(b.id) ?? [];
    const used = sessionsUsed.length;
    const status: BonoStatus = b.cancelledAt
      ? "cancelled"
      : b.validFrom > today
        ? "upcoming"
        : b.validUntil && b.validUntil < today
          ? "expired"
          : b.kind === "sessions" && used >= (b.totalSessions ?? 0)
            ? "used_up"
            : "active";
    return {
      id: b.id,
      bonoTypeId: b.bonoTypeId,
      name: b.name,
      kind: b.kind as BonoKind,
      serviceId: b.serviceId,
      serviceName: b.serviceName,
      patientId: b.patientId,
      firstName: r.currentPatientFirst ?? b.firstName,
      lastName: r.currentPatientLast ?? b.lastName,
      contact: b.contact,
      totalSessions: b.totalSessions,
      sessionsPerWeek: b.sessionsPerWeek,
      usedSessions: used,
      // Monthly: sessions used in the current week (Monday to Sunday)
      usedThisWeek: sessionsUsed.filter((u) => mondayOf(u.day) === thisWeek).length,
      validFrom: b.validFrom,
      validUntil: b.validUntil,
      priceCents: b.priceCents,
      note: b.note,
      status,
      cancelReason: b.cancelReason,
      payment: r.paymentId
        ? {
            id: r.paymentId,
            method: r.paymentMethod as PaymentMethod,
            paidAt: r.paymentPaidAt!,
            refundedCents: r.refundedCents,
            // Who can refund it when cancelling: managers, or whoever recorded it
            recordedById: r.paymentRecordedBy,
          }
        : null,
      createdAt: b.createdAt,
    };
  });
}

// ── H6: paying sessions with a bono ──────────────────────────────────────

type Executor = typeof db | Tx;

// "2026-11-19" -> the Monday of its week, "2026-11-16"
export const mondayOf = (day: string) => addDaysIso(day, 1 - isoWeekdayOf(day));

// The sessions that count against each bono, with their day (clinic time).
// A session stops counting on its own (back to the bono) when its appointment
// is cancelled or deleted, the patient leaves it, a manual session is
// cancelled, or it's a no-show and the clinic doesn't charge no-shows.
// It's also checked again against its bono every time, because the
// appointment can change after it was paid: moved out of the bono's month or
// past its expiry, another service or patient, or a cancelled appointment
// re-activated when the bono had no sessions left. Those don't count and come
// back in `problems` (chargeId -> why): Cobros shows them to review
export async function bonoCoverage(exec: Executor, clinicId: string, bonoIds: string[]) {
  const usage = new Map<string, { chargeId: string; day: string }[]>();
  const problems = new Map<string, string>();
  if (bonoIds.length === 0) return { usage, problems };
  const settings = await getChargeSettings(clinicId);
  const timeZone = await loadTimezone(clinicId);
  const bonos = await exec
    .select()
    .from(bono)
    .where(and(eq(bono.organizationId, clinicId), inArray(bono.id, bonoIds)));
  const rows = await exec
    .select({
      chargeId: sessionCharge.id,
      bonoId: sessionCharge.bonoId,
      source: sessionCharge.source,
      cancelledAt: sessionCharge.cancelledAt,
      occurredAt: sessionCharge.occurredAt,
      overLimitReason: sessionCharge.overLimitReason,
      manualServiceId: sessionCharge.serviceId,
      manualPatientId: sessionCharge.patientId,
      appointmentPatientId: sessionCharge.appointmentPatientId,
      startsAt: appointment.startsAt,
      status: appointment.status,
      appointmentServiceId: appointment.serviceId,
      attendance: appointmentPatient.attendance,
      patientId: appointmentPatient.patientId,
    })
    .from(sessionCharge)
    .leftJoin(appointmentPatient, eq(sessionCharge.appointmentPatientId, appointmentPatient.id))
    .leftJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
    .where(and(eq(sessionCharge.organizationId, clinicId), inArray(sessionCharge.bonoId, bonoIds)));

  const counting = rows
    .filter((r) =>
      r.source === "manual"
        ? !r.cancelledAt
        : !!r.appointmentPatientId &&
          r.status !== "cancelled" &&
          !(outcome(r.status!, r.attendance!) === "no_show" && !settings.chargeNoShows),
    )
    .map((r) => ({
      ...r,
      day: utcToZoned(r.startsAt ?? r.occurredAt, timeZone).date,
      serviceId: r.source === "manual" ? r.manualServiceId : r.appointmentServiceId,
      patientId: r.source === "manual" ? r.manualPatientId : r.patientId,
    }))
    // Oldest first: when there are too many, the latest ones are the extra
    .sort((a, b) => a.day.localeCompare(b.day) || a.chargeId.localeCompare(b.chargeId));

  for (const b of bonos) {
    const accepted: { chargeId: string; day: string }[] = [];
    for (const r of counting.filter((c) => c.bonoId === b.id)) {
      // A bono cancelled later keeps the sessions it already paid, and so does
      // one whose service was deleted afterwards (only possible with manual
      // sessions: services with appointments can't be deleted)
      const problem = bonoProblem(
        { ...b, cancelledAt: null, serviceId: b.serviceId ?? "deleted" },
        { ...r, serviceId: b.serviceId ? r.serviceId : "deleted" },
        r.day,
        accepted,
      );
      if (problem && !(problem.overridable && r.overLimitReason)) {
        problems.set(r.chargeId, problem.reason);
        continue;
      }
      accepted.push({ chargeId: r.chargeId, day: r.day });
    }
    if (accepted.length > 0) usage.set(b.id, accepted);
  }
  return { usage, problems };
}

export async function bonoUsage(exec: Executor, clinicId: string, bonoIds: string[]) {
  return (await bonoCoverage(exec, clinicId, bonoIds)).usage;
}

type BonoRow = typeof bono.$inferSelect;

// "2026-11-19" -> "19 nov 2026" · "2026-12-01" -> "diciembre de 2026"
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(".", "");
const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );

// Why this bono can't pay this session (null: it can). `overridable`: only
// the weekly limit, which can be skipped on purpose with a reason
function bonoProblem(
  b: BonoRow,
  session: { serviceId: string | null; patientId: string | null },
  day: string,
  used: { chargeId: string; day: string }[],
): { reason: string; overridable: boolean } | null {
  if (b.cancelledAt) return { reason: "Está anulado", overridable: false };
  if (!b.serviceId || b.serviceId !== session.serviceId) {
    return { reason: `Es de ${b.serviceName}, no de este servicio`, overridable: false };
  }
  if (b.patientId && b.patientId !== session.patientId) {
    return { reason: "Es de otro paciente", overridable: false };
  }
  // A monthly bono only covers its month. A sessions bono can also pay
  // sessions from before it was sold (the patient buys it after a session that
  // isn't paid yet): only its expiry counts
  if (b.kind === "monthly" && (day < b.validFrom || day > b.validUntil!)) {
    return { reason: `Es de ${monthLabel(b.validFrom)}`, overridable: false };
  }
  if (b.kind === "sessions" && b.validUntil && day > b.validUntil) {
    return { reason: `Caducó el ${dayLabel(b.validUntil)}`, overridable: false };
  }
  if (b.kind === "sessions" && used.length >= (b.totalSessions ?? 0)) {
    return { reason: "Ya no le quedan sesiones", overridable: false };
  }
  if (b.kind === "monthly" && b.sessionsPerWeek) {
    const week = mondayOf(day);
    const thisWeek = used.filter((u) => mondayOf(u.day) === week).length;
    if (thisWeek >= b.sessionsPerWeek) {
      return {
        reason: `Ya ha usado ${thisWeek} de ${b.sessionsPerWeek} sesiones esa semana`,
        overridable: true,
      };
    }
  }
  return null;
}

// The session can be paid now (not paid, not waived, not with a bono, and
// pending, unconfirmed or upcoming)
async function sessionToPay(tx: Tx, actor: Actor, sessionId: string, now: Date) {
  const settings = await getChargeSettings(actor.clinicId);
  const timeZone = await loadTimezone(actor.clinicId);
  const [session] = await loadTargetSessions(tx, actor.clinicId, [sessionId]);
  assertAfterStart([session!], zonedToUtc(settings.startsOn, "00:00", timeZone));
  const row = (await lockChargeRows(tx, actor, [session!])).get(session!.key)!;
  if (row.paymentId) throw new ChargeError(409, "ALREADY_PAID", "La sesión ya está cobrada");
  if (row.waivedReason) throw new ChargeError(409, "WAIVED", "La sesión está marcada sin cargo");
  if (row.bonoId) throw new ChargeError(409, "PAID_WITH_BONO", "La sesión ya está pagada con un bono");
  const state = sessionState({ ...session!, priceCents: row.priceCents }, settings, now);
  if (!["pending", "to_confirm", "upcoming"].includes(state)) {
    throw new ChargeError(
      409,
      "NOTHING_TO_PAY",
      state === "free" ? "La sesión no tiene precio" : "Es una falta que la clínica no cobra",
    );
  }
  return { session: session!, row, state, day: utcToZoned(session!.startsAt, timeZone).date };
}

// Pays a session with a bono: one session less (or one of the week, for a
// monthly bono). The bono row is locked, so two sessions can't take its last
// place at the same time
export async function useBono(
  actor: Actor,
  sessionId: string,
  input: { bonoId: string; overLimitReason: string | null },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [b] = await tx
      .select()
      .from(bono)
      .where(and(eq(bono.id, input.bonoId), eq(bono.organizationId, actor.clinicId)))
      .for("update");
    if (!b) throw new ChargeError(404, "BONO_NOT_FOUND", "El bono no existe en tu clínica");
    const { session, row, state, day } = await sessionToPay(tx, actor, sessionId, now);
    const used = (await bonoUsage(tx, actor.clinicId, [b.id])).get(b.id) ?? [];
    const problem = bonoProblem(b, session, day, used);
    if (problem && !(problem.overridable && input.overLimitReason)) {
      throw new ChargeError(409, problem.overridable ? "WEEK_LIMIT" : "BONO_NOT_USABLE", problem.reason);
    }
    await tx
      .update(sessionCharge)
      .set({ bonoId: b.id, overLimitReason: problem ? input.overLimitReason : null })
      .where(eq(sessionCharge.id, row.id));
    if (state === "to_confirm") await confirmSession(tx, actor, session);
    await logEvent(tx, actor, "session", row.id, "bono_used", {
      bonoId: b.id,
      overLimitReason: problem ? input.overLimitReason : null,
    });
  });
}

// Takes a session off its bono (a mistake): it's pending again and the bono
// gets the session back
export async function stopUsingBono(actor: Actor, sessionId: string) {
  return db.transaction(async (tx) => {
    const [session] = await loadTargetSessions(tx, actor.clinicId, [sessionId]);
    const row = (await lockChargeRows(tx, actor, [session!])).get(session!.key)!;
    if (!row.bonoId) throw new ChargeError(404, "NOT_WITH_BONO", "Esa sesión no está pagada con un bono");
    await tx
      .update(sessionCharge)
      .set({ bonoId: null, overLimitReason: null })
      .where(eq(sessionCharge.id, row.id));
    await logEvent(tx, actor, "session", row.id, "bono_removed", { bonoId: row.bonoId });
  });
}

// The bonos that could pay this session: the person's bonos (by ficha; without
// ficha, those of the same name), each saying whether it can and, if not, why
export async function bonosForSession(clinicId: string, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const timeZone = await loadTimezone(clinicId);
    const [session] = await loadTargetSessions(tx, clinicId, [sessionId]);
    const day = utcToZoned(session!.startsAt, timeZone).date;
    const candidates = session!.patientId
      ? await tx.select().from(bono).where(and(eq(bono.organizationId, clinicId), eq(bono.patientId, session!.patientId)))
      : (
          await tx
            .select()
            .from(bono)
            .where(and(eq(bono.organizationId, clinicId), isNull(bono.patientId)))
        ).filter(
          (b) =>
            normalizeName(`${b.firstName} ${b.lastName}`) ===
            normalizeName(`${session!.firstName} ${session!.lastName}`),
        );
    const open = candidates.filter((b) => !b.cancelledAt);
    const usage = await bonoUsage(tx, clinicId, open.map((b) => b.id));
    const listed = await listBonos(clinicId, { bonoIds: open.map((b) => b.id) }, now);
    const monday = mondayOf(day);
    return open.map((b) => {
      const used = usage.get(b.id) ?? [];
      const problem = bonoProblem(b, session!, day, used);
      return {
        bono: listed.find((l) => l.id === b.id)!,
        usable: !problem,
        reason: problem?.reason ?? null,
        overridable: problem?.overridable ?? false,
        // Monthly bonos: the week of this session (Monday to Sunday) and how
        // many of its sessions are already used
        week:
          b.kind === "monthly"
            ? {
                from: monday,
                to: addDaysIso(monday, 6),
                used: used.filter((u) => mondayOf(u.day) === monday).length,
              }
            : null,
      };
    });
  });
}

const normalizeName = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
