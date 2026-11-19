import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentEvent,
  appointmentPatient,
  billingEvent,
  bono,
  member,
  patient,
  payment,
  service,
  sessionCharge,
  user,
} from "../db/schema.js";
import {
  CHARGE_MANAGER_ROLES,
  getChargeSettings,
  outcome,
  sessionState,
  type PaymentMethod,
} from "./charges.js";
import { PROFESSIONAL_ROLES } from "./appointments.js";
import { loadTimezone } from "./clinicSchedule.js";
import type { ClinicRole } from "./permissions.js";
import { utcToZoned, zonedToUtc } from "./timezone.js";

// What changes a payment or a session's charge (COBROS.md, H2). Every change
// runs in one transaction, locks the rows it touches (two people charging the
// same session at once: the second gets "already paid") and leaves a line in
// billing_event. Nothing is ever deleted: payments are voided or refunded.

export class ChargeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Actor = { clinicId: string; userId: string; role: ClinicRole };

// A session is referred to by one id (ChargeSession.id in lib/charges.ts):
// the appointment_patient id for calendar sessions, the session_charge id for
// manual ones. This loads them with what a charge needs
export async function loadTargetSessions(tx: Tx, clinicId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const calendar = await tx
    .select({
      appointmentPatientId: appointmentPatient.id,
      appointmentId: appointment.id,
      startsAt: appointment.startsAt,
      appointmentStatus: appointment.status,
      attendance: appointmentPatient.attendance,
      patientId: appointmentPatient.patientId,
      firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName})`,
      lastName: sql<string>`coalesce(${patient.lastName}, ${appointmentPatient.lastName})`,
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.priceCents,
      isGroup: service.isGroup,
      physioId: appointment.physioId,
    })
    .from(appointmentPatient)
    .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
    .where(
      and(
        eq(appointmentPatient.organizationId, clinicId),
        eq(appointment.organizationId, clinicId),
        inArray(appointmentPatient.id, unique),
      ),
    );

  const rest = unique.filter((id) => !calendar.some((c) => c.appointmentPatientId === id));
  const manual = rest.length
    ? await tx
        .select()
        .from(sessionCharge)
        .where(
          and(
            eq(sessionCharge.organizationId, clinicId),
            eq(sessionCharge.source, "manual"),
            inArray(sessionCharge.id, rest),
          ),
        )
    : [];

  if (calendar.length + manual.length !== unique.length) {
    throw new ChargeError(404, "SESSION_NOT_FOUND", "Alguna de las sesiones no existe en tu clínica");
  }
  if (calendar.some((r) => r.appointmentStatus === "cancelled")) {
    throw new ChargeError(409, "APPOINTMENT_CANCELLED", "Alguna de las citas está cancelada");
  }
  if (manual.some((r) => r.cancelledAt)) {
    throw new ChargeError(409, "SESSION_CANCELLED", "Alguna de las sesiones está anulada");
  }

  return [
    ...calendar.map((c) => ({ ...c, key: c.appointmentPatientId, kind: "calendar" as const })),
    ...manual.map((m) => ({
      key: m.id,
      kind: "manual" as const,
      appointmentPatientId: null,
      appointmentId: null,
      startsAt: m.occurredAt,
      // A manual session is recorded because it happened
      appointmentStatus: "completed" as const,
      attendance: "attended" as const,
      patientId: m.patientId,
      firstName: m.firstName,
      lastName: m.lastName,
      serviceId: m.serviceId,
      serviceName: m.serviceName ?? "",
      servicePrice: m.priceCents,
      isGroup: false,
      physioId: m.physioId,
    })),
  ];
}

export type TargetSession = Awaited<ReturnType<typeof loadTargetSessions>>[number];

// Sessions before the clinic's start date don't appear anywhere in Cobros, so
// nothing may be charged for them either
export function assertAfterStart(sessions: TargetSession[], startsAt: Date) {
  const early = sessions.find((s) => s.startsAt < startsAt);
  if (early) {
    throw new ChargeError(
      409,
      "BEFORE_START",
      `La sesión de ${early.firstName} es anterior a la fecha de inicio de los cobros`,
    );
  }
}

// The charge rows of those sessions, by session id, locked until the end of
// the transaction. Calendar sessions get theirs created if missing (with the
// service's price today, which from now on stays frozen)
export async function lockChargeRows(tx: Tx, actor: Actor, sessions: TargetSession[]) {
  // Always in the same order (by id): two payments sharing sessions, sent in
  // opposite order, would otherwise lock each other forever (deadlock)
  const calendar = sessions
    .filter((s) => s.kind === "calendar")
    .sort((a, b) => a.key.localeCompare(b.key));
  if (calendar.length > 0) {
    await tx
      .insert(sessionCharge)
      .values(
        calendar.map((s) => ({
          organizationId: actor.clinicId,
          source: "calendar",
          appointmentPatientId: s.appointmentPatientId,
          patientId: s.patientId,
          firstName: s.firstName,
          lastName: s.lastName,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          physioId: s.physioId,
          occurredAt: s.startsAt,
          priceCents: s.servicePrice,
          createdBy: actor.userId,
        })),
      )
      .onConflictDoNothing({ target: sessionCharge.appointmentPatientId });
  }
  const manualIds = sessions.filter((s) => s.kind === "manual").map((s) => s.key);
  const calendarIds = calendar.map((s) => s.key);

  const rows = await tx
    .select()
    .from(sessionCharge)
    .where(
      and(
        eq(sessionCharge.organizationId, actor.clinicId),
        or(
          calendarIds.length ? inArray(sessionCharge.appointmentPatientId, calendarIds) : undefined,
          manualIds.length ? inArray(sessionCharge.id, manualIds) : undefined,
        ),
      ),
    )
    .orderBy(asc(sessionCharge.id))
    .for("update");
  return new Map(rows.map((r) => [r.appointmentPatientId ?? r.id, r]));
}

export async function logEvent(
  tx: Tx,
  actor: Actor,
  entity: "payment" | "session" | "bono",
  entityId: string,
  action: string,
  data: Record<string, unknown>,
) {
  await tx.insert(billingEvent).values({
    organizationId: actor.clinicId,
    entity,
    entityId,
    action,
    data,
    changedBy: actor.userId,
  });
}

// The clinic's date today ("YYYY-MM-DD")
async function clinicToday(clinicId: string, now: Date) {
  return utcToZoned(now, await loadTimezone(clinicId)).date;
}

// A calendar session nobody marked yet is confirmed by whoever charges it (or
// pays it with a bono): the patient is marked as attended and, in an
// individual appointment, the appointment as done (with its history line)
export async function confirmSession(tx: Tx, actor: Actor, session: TargetSession) {
  const { appointmentPatientId, appointmentId } = session;
  if (!appointmentPatientId || !appointmentId) return;
  await tx
    .update(appointmentPatient)
    .set({ attendance: "attended" })
    .where(eq(appointmentPatient.id, appointmentPatientId));
  if (!session.isGroup) {
    await tx
      .update(appointment)
      .set({ status: "completed", updatedBy: actor.userId })
      .where(eq(appointment.id, appointmentId));
    await tx.insert(appointmentEvent).values({
      appointmentId,
      organizationId: actor.clinicId,
      type: "status_changed",
      changes: { status: { from: session.appointmentStatus, to: "completed" } },
      changedBy: actor.userId,
    });
  }
}

// Marks from Cobros what happened in a calendar session nobody marked yet,
// without going back to the calendar: "came" (then it's pending, or free) or
// "no_show" (charged or not, as the clinic's settings say). Same writes as the
// calendar: the patient's attendance and, in an individual appointment, its
// status, with its history line
export async function markSessionOutcome(
  actor: Actor,
  sessionId: string,
  result: "came" | "no_show",
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [session] = await loadTargetSessions(tx, actor.clinicId, [sessionId]);
    if (!session || session.kind !== "calendar") {
      throw new ChargeError(404, "SESSION_NOT_FOUND", "Esa sesión no está en la agenda");
    }
    // Lock the appointment: two people marking it at once see the same state
    await tx.select({ id: appointment.id }).from(appointment).where(eq(appointment.id, session.appointmentId!)).for("update");
    const [fresh] = await loadTargetSessions(tx, actor.clinicId, [sessionId]);
    if (fresh!.startsAt > now) {
      throw new ChargeError(409, "NOT_STARTED", "La sesión todavía no ha empezado");
    }
    if (outcome(fresh!.appointmentStatus, fresh!.attendance) !== "unknown") {
      throw new ChargeError(409, "ALREADY_MARKED", "Esa sesión ya está marcada");
    }
    if (result === "came") {
      await confirmSession(tx, actor, fresh!);
      return;
    }
    await tx
      .update(appointmentPatient)
      .set({ attendance: "no_show" })
      .where(eq(appointmentPatient.id, fresh!.appointmentPatientId!));
    if (!fresh!.isGroup) {
      await tx
        .update(appointment)
        .set({ status: "no_show", updatedBy: actor.userId })
        .where(eq(appointment.id, fresh!.appointmentId!));
      await tx.insert(appointmentEvent).values({
        appointmentId: fresh!.appointmentId!,
        organizationId: actor.clinicId,
        type: "status_changed",
        changes: { status: { from: fresh!.appointmentStatus, to: "no_show" } },
        changedBy: actor.userId,
      });
    }
  });
}

// ── Charging ─────────────────────────────────────────────────────────────

export type ChargeInput = {
  // sessionId: ChargeSession.id (calendar or manual session)
  sessions: { sessionId: string; priceCents?: number }[];
  method: PaymentMethod;
  // "YYYY-MM-DD" (clinic day). Today, or a day in the past for a payment
  // recorded late. Missing: now
  paidOn?: string;
  note: string | null;
};

// Records one payment for one or more sessions. Sessions not confirmed yet
// (to_confirm) are marked as attended: whoever charges them confirms they
// happened. Future sessions can be paid in advance
// When a payment happened: now, or midday of `paidOn` (a payment recorded
// late). Never in the future, never before the start date (it would change
// the cash of days Cobros doesn't count)
export async function resolvePaidAt(clinicId: string, paidOn: string | undefined, now = new Date()) {
  const settings = await getChargeSettings(clinicId);
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(now, timeZone).date;
  if (paidOn && paidOn > today) {
    throw new ChargeError(400, "PAID_IN_FUTURE", "La fecha del cobro no puede ser futura");
  }
  if (paidOn && paidOn < settings.startsOn) {
    throw new ChargeError(
      400,
      "PAID_BEFORE_START",
      "La fecha del cobro no puede ser anterior a la fecha de inicio de los cobros",
    );
  }
  return !paidOn || paidOn === today ? now : zonedToUtc(paidOn, "12:00", timeZone);
}

export async function chargeSessions(actor: Actor, input: ChargeInput, now = new Date()) {
  const settings = await getChargeSettings(actor.clinicId);
  const timeZone = await loadTimezone(actor.clinicId);
  const paidAt = await resolvePaidAt(actor.clinicId, input.paidOn, now);
  const startsAt = zonedToUtc(settings.startsOn, "00:00", timeZone);

  return db.transaction(async (tx) => {
    const ids = input.sessions.map((s) => s.sessionId);
    const sessions = await loadTargetSessions(tx, actor.clinicId, ids);
    assertAfterStart(sessions, startsAt);
    const rows = await lockChargeRows(tx, actor, sessions);

    const lines = sessions.map((s) => {
      const row = rows.get(s.key)!;
      if (row.paymentId) {
        throw new ChargeError(409, "ALREADY_PAID", `La sesión de ${s.firstName} ya está cobrada`);
      }
      if (row.waivedReason) {
        throw new ChargeError(409, "WAIVED", `La sesión de ${s.firstName} está marcada sin cargo`);
      }
      if (row.bonoId) {
        throw new ChargeError(409, "PAID_WITH_BONO", `La sesión de ${s.firstName} ya está pagada con un bono`);
      }
      const requested = input.sessions.find((i) => i.sessionId === s.key);
      const priceCents = requested?.priceCents ?? row.priceCents;
      if (priceCents <= 0) {
        throw new ChargeError(400, "NOTHING_TO_CHARGE", `La sesión de ${s.firstName} no tiene precio`);
      }
      const state = sessionState({ ...s, priceCents }, settings, now);
      return { session: s, row, priceCents, state };
    });

    const amountCents = lines.reduce((sum, l) => sum + l.priceCents, 0);
    // Who paid: the patient, when all the sessions are theirs
    const first = sessions[0]!;
    const samePerson = sessions.every((s) =>
      first.patientId
        ? s.patientId === first.patientId
        : !s.patientId && s.firstName === first.firstName && s.lastName === first.lastName,
    );

    const [created] = await tx
      .insert(payment)
      .values({
        organizationId: actor.clinicId,
        kind: "sessions",
        amountCents,
        method: input.method,
        paidAt,
        patientId: samePerson ? first.patientId : null,
        firstName: samePerson ? first.firstName : null,
        lastName: samePerson ? first.lastName : null,
        note: input.note,
        recordedBy: actor.userId,
      })
      .returning();

    for (const l of lines) {
      await tx
        .update(sessionCharge)
        .set({ paymentId: created!.id, priceCents: l.priceCents })
        .where(eq(sessionCharge.id, l.row.id));
    }

    // Charging confirms sessions nobody had marked yet
    for (const l of lines.filter((l) => l.state === "to_confirm")) {
      await confirmSession(tx, actor, l.session);
    }

    await logEvent(tx, actor, "payment", created!.id, "paid", {
      amountCents,
      method: input.method,
      sessions: lines.map((l) => ({ chargeId: l.row.id, priceCents: l.priceCents })),
    });
    return created!;
  });
}

// ── Voiding, refunding, moving ──────────────────────────────────────────

// The payment, locked until the end of the transaction. `untouched`: also
// refuse it if part of it was already refunded (voiding needs the whole one)
// `allowBono`: bono payments too (voiding one). Refunding and moving are for
// session payments; a bono's money goes back by cancelling the bono
async function lockPayment(
  tx: Tx,
  clinicId: string,
  paymentId: string,
  untouched = false,
  allowBono = false,
) {
  const [found] = await tx
    .select()
    .from(payment)
    .where(and(eq(payment.id, paymentId), eq(payment.organizationId, clinicId)))
    .for("update");
  if (!found) throw new ChargeError(404, "PAYMENT_NOT_FOUND", "El cobro no existe en tu clínica");
  if (found.kind === "refund") {
    throw new ChargeError(409, "NOT_A_SESSION_PAYMENT", "Una devolución no se puede cambiar");
  }
  if (found.kind === "bono" && !allowBono) {
    throw new ChargeError(
      409,
      "BONO_PAYMENT",
      "Es el cobro de un bono: para devolver el dinero, anula el bono",
    );
  }
  if (found.voidedAt) throw new ChargeError(409, "PAYMENT_VOIDED", "Este cobro está anulado");
  if (untouched) {
    const [refund] = await tx
      .select({ id: payment.id })
      .from(payment)
      .where(and(eq(payment.organizationId, clinicId), eq(payment.refundOfId, paymentId)))
      .limit(1);
    if (refund) {
      throw new ChargeError(
        409,
        "PAYMENT_REFUNDED",
        "Este cobro ya tiene devoluciones: no se puede anular. Devuelve lo que quede",
      );
    }
  }
  return found;
}

export const isManager = (role: ClinicRole) => (CHARGE_MANAGER_ROLES as readonly string[]).includes(role);

// Unlinks the payment from its sessions: they go back to where they stood
// (pending, or gone if their appointment was cancelled)
async function releaseSessions(tx: Tx, clinicId: string, paymentId: string) {
  return tx
    .update(sessionCharge)
    .set({ paymentId: null })
    .where(and(eq(sessionCharge.organizationId, clinicId), eq(sessionCharge.paymentId, paymentId)))
    .returning({ id: sessionCharge.id });
}

// A mistake: the payment never happened and doesn't count in the cash
// register. Owners and admins always; whoever recorded it, the same day
export async function voidPayment(actor: Actor, paymentId: string, reason: string, now = new Date()) {
  const today = await clinicToday(actor.clinicId, now);
  const timeZone = await loadTimezone(actor.clinicId);
  return db.transaction(async (tx) => {
    const found = await lockPayment(tx, actor.clinicId, paymentId, true, true);
    const ownToday =
      found.recordedBy === actor.userId && utcToZoned(found.createdAt, timeZone).date === today;
    if (!isManager(actor.role) && !ownToday) {
      throw new ChargeError(
        403,
        "VOID_NOT_ALLOWED",
        "Solo puedes anular tus cobros del mismo día. Pídeselo a un administrador",
      );
    }
    await tx
      .update(payment)
      .set({ voidedAt: now, voidedBy: actor.userId, voidReason: reason })
      .where(eq(payment.id, paymentId));
    const released = await releaseSessions(tx, actor.clinicId, paymentId);
    await logEvent(tx, actor, "payment", paymentId, "voided", {
      reason,
      sessions: released.map((r) => r.id),
    });
  });
}

// Money goes back to the patient today, for some or all of the payment's
// sessions: a negative payment that counts in today's cash register. The
// original payment stays as it was; the refunded sessions are released (back
// to pending, or gone if their appointment was cancelled). Owners and admins
// refund any payment; reception only the ones they recorded
export async function refundPayment(
  actor: Actor,
  paymentId: string,
  input: { method: PaymentMethod; note: string | null; chargeIds?: string[] },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const found = await lockPayment(tx, actor.clinicId, paymentId);
    if (!isManager(actor.role) && found.recordedBy !== actor.userId) {
      throw new ChargeError(
        403,
        "REFUND_NOT_ALLOWED",
        "Solo puedes devolver los cobros que registraste tú. Pídeselo a un administrador",
      );
    }
    const linked = await tx
      .select({ id: sessionCharge.id, priceCents: sessionCharge.priceCents })
      .from(sessionCharge)
      .where(and(eq(sessionCharge.organizationId, actor.clinicId), eq(sessionCharge.paymentId, paymentId)))
      .orderBy(asc(sessionCharge.id))
      .for("update");
    if (linked.length === 0) {
      throw new ChargeError(409, "NOTHING_TO_REFUND", "Este cobro ya no tiene sesiones que devolver");
    }
    const chosen = input.chargeIds ? linked.filter((l) => input.chargeIds!.includes(l.id)) : linked;
    if (input.chargeIds && chosen.length !== new Set(input.chargeIds).size) {
      throw new ChargeError(404, "SESSION_NOT_FOUND", "Alguna sesión no está pagada con este cobro");
    }
    const amountCents = chosen.reduce((sum, l) => sum + l.priceCents, 0);
    if (amountCents <= 0) {
      throw new ChargeError(409, "NOTHING_TO_REFUND", "Esas sesiones no tienen importe que devolver");
    }

    const [refund] = await tx
      .insert(payment)
      .values({
        organizationId: actor.clinicId,
        kind: "refund",
        amountCents: -amountCents,
        method: input.method,
        paidAt: now,
        patientId: found.patientId,
        firstName: found.firstName,
        lastName: found.lastName,
        note: input.note,
        refundOfId: found.id,
        recordedBy: actor.userId,
      })
      .returning();
    await tx
      .update(sessionCharge)
      .set({ paymentId: null })
      .where(inArray(sessionCharge.id, chosen.map((l) => l.id)));
    await logEvent(tx, actor, "payment", paymentId, "refunded", {
      refundId: refund!.id,
      amountCents,
      method: input.method,
      sessions: chosen.map((l) => l.id),
      partial: chosen.length < linked.length,
    });
    return refund!;
  });
}

// A paid session that has to be reviewed (its appointment was cancelled or
// deleted, the patient left it, or it was a manual session that got
// cancelled) passes its payment to another session
export async function movePayment(
  actor: Actor,
  paymentId: string,
  input: { fromChargeId: string; toSessionId: string },
) {
  const settings = await getChargeSettings(actor.clinicId);
  const startsAt = zonedToUtc(settings.startsOn, "00:00", await loadTimezone(actor.clinicId));
  return db.transaction(async (tx) => {
    await lockPayment(tx, actor.clinicId, paymentId);
    const [from] = await tx
      .select({
        row: sessionCharge,
        appointmentStatus: appointment.status,
      })
      .from(sessionCharge)
      .leftJoin(appointmentPatient, eq(sessionCharge.appointmentPatientId, appointmentPatient.id))
      .leftJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
      .where(
        and(
          eq(sessionCharge.id, input.fromChargeId),
          eq(sessionCharge.organizationId, actor.clinicId),
          eq(sessionCharge.paymentId, paymentId),
        ),
      )
      .for("update", { of: sessionCharge });
    if (!from) {
      throw new ChargeError(404, "SESSION_NOT_FOUND", "Esa sesión no está pagada con este cobro");
    }
    const inReview =
      from.row.source === "manual"
        ? !!from.row.cancelledAt
        : !from.row.appointmentPatientId || from.appointmentStatus === "cancelled";
    if (!inReview) {
      throw new ChargeError(
        409,
        "NOT_IN_REVIEW",
        "Solo se mueve el cobro de una sesión cancelada o que ya no está en la agenda",
      );
    }

    const [to] = await loadTargetSessions(tx, actor.clinicId, [input.toSessionId]);
    assertAfterStart([to!], startsAt);
    const target = (await lockChargeRows(tx, actor, [to!])).get(to!.key)!;
    if (target.paymentId) throw new ChargeError(409, "ALREADY_PAID", "Esa sesión ya está cobrada");
    if (target.waivedReason) {
      throw new ChargeError(409, "WAIVED", "Esa sesión está marcada sin cargo");
    }
    if (target.bonoId) {
      throw new ChargeError(409, "PAID_WITH_BONO", "Esa sesión ya está pagada con un bono");
    }

    await tx
      .update(sessionCharge)
      .set({ paymentId: null })
      .where(eq(sessionCharge.id, from.row.id));
    // The payment keeps its amount: the session takes the price it paid
    await tx
      .update(sessionCharge)
      .set({ paymentId, priceCents: from.row.priceCents })
      .where(eq(sessionCharge.id, target.id));
    await logEvent(tx, actor, "payment", paymentId, "moved", {
      from: from.row.id,
      to: target.id,
    });
  });
}

// ── Price and "sin cargo" of one session ─────────────────────────────────

async function lockSession(tx: Tx, actor: Actor, sessionId: string) {
  const [session] = await loadTargetSessions(tx, actor.clinicId, [sessionId]);
  return (await lockChargeRows(tx, actor, [session!])).get(session!.key)!;
}

async function lockUnpaid(tx: Tx, actor: Actor, sessionId: string) {
  const row = await lockSession(tx, actor, sessionId);
  if (row.paymentId) {
    throw new ChargeError(409, "ALREADY_PAID", "La sesión ya está cobrada: anula el cobro primero");
  }
  if (row.bonoId) {
    throw new ChargeError(409, "PAID_WITH_BONO", "La sesión está pagada con un bono: quítala del bono primero");
  }
  return row;
}

export async function setSessionPrice(actor: Actor, sessionId: string, priceCents: number) {
  // 0 € would be "not charging it" without saying why: that's what waiving is for
  if (priceCents <= 0) {
    throw new ChargeError(400, "USE_WAIVE", "Para no cobrar una sesión, usa «No cobrar esta sesión»");
  }
  return db.transaction(async (tx) => {
    const row = await lockUnpaid(tx, actor, sessionId);
    if (row.priceCents === priceCents) return;
    await tx.update(sessionCharge).set({ priceCents }).where(eq(sessionCharge.id, row.id));
    await logEvent(tx, actor, "session", row.id, "price_changed", {
      from: row.priceCents,
      to: priceCents,
    });
  });
}

export async function waiveSession(actor: Actor, sessionId: string, reason: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const row = await lockUnpaid(tx, actor, sessionId);
    await tx
      .update(sessionCharge)
      .set({ waivedReason: reason, waivedBy: actor.userId, waivedAt: now })
      .where(eq(sessionCharge.id, row.id));
    await logEvent(tx, actor, "session", row.id, "waived", { reason });
  });
}

export async function unwaiveSession(actor: Actor, sessionId: string) {
  return db.transaction(async (tx) => {
    const row = await lockSession(tx, actor, sessionId);
    if (!row.waivedReason) {
      throw new ChargeError(404, "SESSION_NOT_FOUND", "Esa sesión no está marcada sin cargo");
    }
    await tx
      .update(sessionCharge)
      .set({ waivedReason: null, waivedBy: null, waivedAt: null })
      .where(eq(sessionCharge.id, row.id));
    await logEvent(tx, actor, "session", row.id, "unwaived", {});
  });
}

// ── Manual sessions (not in the calendar, H3) ───────────────────────────

export type ManualSessionInput = {
  patient: { patientId: string } | { firstName: string; lastName: string };
  serviceId: string;
  physioId: string | null;
  date: string; // "YYYY-MM-DD", clinic day
  // "HH:MM". Missing: now if it's today, midday otherwise
  time?: string;
  priceCents?: number; // missing: the service's price
  note: string; // why it isn't in the calendar
};

// A session that happened but isn't in the calendar: from the start date
// until now, for a ficha of the clinic or a name, an active service of the
// clinic and (optionally) one of its professionals
export async function createManualSession(actor: Actor, input: ManualSessionInput, now = new Date()) {
  const settings = await getChargeSettings(actor.clinicId);
  const timeZone = await loadTimezone(actor.clinicId);
  const local = utcToZoned(now, timeZone);
  const time = input.time ?? (input.date === local.date ? local.time : "12:00");
  const occurredAt = zonedToUtc(input.date, time, timeZone);
  if (input.date < settings.startsOn) {
    throw new ChargeError(409, "BEFORE_START", "La fecha es anterior a la fecha de inicio de los cobros");
  }
  if (occurredAt > now) {
    throw new ChargeError(400, "IN_FUTURE", "Una sesión fuera de la agenda tiene que haber pasado ya");
  }

  const [svc] = await db
    .select({ id: service.id, name: service.name, priceCents: service.priceCents, isActive: service.isActive })
    .from(service)
    .where(and(eq(service.id, input.serviceId), eq(service.organizationId, actor.clinicId)));
  if (!svc || !svc.isActive) {
    throw new ChargeError(404, "SERVICE_NOT_FOUND", "El servicio no existe o está desactivado");
  }

  if (input.physioId) {
    const [pro] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, actor.clinicId), eq(member.userId, input.physioId)));
    if (!pro || !(PROFESSIONAL_ROLES as readonly string[]).includes(pro.role)) {
      throw new ChargeError(404, "PHYSIO_NOT_FOUND", "Ese profesional no es de tu clínica");
    }
  }

  let names: { patientId: string | null; firstName: string; lastName: string };
  if ("patientId" in input.patient) {
    const [ficha] = await db
      .select({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })
      .from(patient)
      .where(and(eq(patient.id, input.patient.patientId), eq(patient.organizationId, actor.clinicId)));
    if (!ficha) throw new ChargeError(404, "PATIENT_NOT_FOUND", "El paciente no existe en tu clínica");
    names = { patientId: ficha.id, firstName: ficha.firstName, lastName: ficha.lastName };
  } else {
    names = { patientId: null, ...input.patient };
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sessionCharge)
      .values({
        organizationId: actor.clinicId,
        source: "manual",
        ...names,
        serviceId: svc.id,
        serviceName: svc.name,
        physioId: input.physioId,
        occurredAt,
        priceCents: input.priceCents ?? svc.priceCents,
        note: input.note,
        createdBy: actor.userId,
      })
      .returning();
    await logEvent(tx, actor, "session", row!.id, "created", { note: input.note });
    return row!;
  });
}

// Cancels a manual session recorded by mistake. If it was paid, it stays as
// "review" until its payment is moved or refunded
export async function cancelManualSession(actor: Actor, sessionId: string, reason: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(sessionCharge)
      .where(
        and(
          eq(sessionCharge.id, sessionId),
          eq(sessionCharge.organizationId, actor.clinicId),
          eq(sessionCharge.source, "manual"),
        ),
      )
      .for("update");
    if (!row) throw new ChargeError(404, "SESSION_NOT_FOUND", "La sesión no existe en tu clínica");
    if (row.cancelledAt) throw new ChargeError(409, "SESSION_CANCELLED", "La sesión ya está anulada");
    await tx
      .update(sessionCharge)
      .set({ cancelledAt: now, cancelledBy: actor.userId, cancelReason: reason })
      .where(eq(sessionCharge.id, row.id));
    await logEvent(tx, actor, "session", row.id, "cancelled", { reason, paid: !!row.paymentId });
  });
}

// ── Reading one payment ─────────────────────────────────────────────────

// A payment with its sessions, its refund and its history (who did what)
export async function loadPayment(clinicId: string, paymentId: string) {
  const [found] = await db
    .select({ payment, recordedByName: user.name })
    .from(payment)
    .leftJoin(user, eq(payment.recordedBy, user.id))
    .where(and(eq(payment.id, paymentId), eq(payment.organizationId, clinicId)));
  if (!found) return null;

  // What the appointment says today (service, time, name); the copy on the
  // charge row when the patient is no longer in it
  const currentService = alias(service, "current_service");
  const sessions = await db
    .select({
      chargeId: sessionCharge.id,
      appointmentPatientId: sessionCharge.appointmentPatientId,
      firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName}, ${sessionCharge.firstName})`,
      lastName: sql<string>`coalesce(${patient.lastName}, ${appointmentPatient.lastName}, ${sessionCharge.lastName})`,
      occurredAt: sql<Date>`coalesce(${appointment.startsAt}, ${sessionCharge.occurredAt})`.mapWith(
        (v) => new Date(v),
      ),
      serviceName: sql<string>`coalesce(${currentService.name}, ${service.name}, ${sessionCharge.serviceName}, 'Servicio eliminado')`,
      priceCents: sessionCharge.priceCents,
    })
    .from(sessionCharge)
    .leftJoin(service, eq(sessionCharge.serviceId, service.id))
    .leftJoin(appointmentPatient, eq(sessionCharge.appointmentPatientId, appointmentPatient.id))
    .leftJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
    .leftJoin(currentService, eq(appointment.serviceId, currentService.id))
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
    .where(and(eq(sessionCharge.organizationId, clinicId), eq(sessionCharge.paymentId, paymentId)))
    .orderBy(asc(sessionCharge.occurredAt));

  const refunds = await db
    .select({
      id: payment.id,
      amountCents: payment.amountCents,
      method: payment.method,
      paidAt: payment.paidAt,
      note: payment.note,
    })
    .from(payment)
    .where(and(eq(payment.organizationId, clinicId), eq(payment.refundOfId, paymentId)))
    .orderBy(asc(payment.paidAt));

  const history = await db
    .select({
      action: billingEvent.action,
      data: billingEvent.data,
      at: billingEvent.createdAt,
      byName: user.name,
    })
    .from(billingEvent)
    .leftJoin(user, eq(billingEvent.changedBy, user.id))
    .where(
      and(
        eq(billingEvent.organizationId, clinicId),
        eq(billingEvent.entity, "payment"),
        eq(billingEvent.entityId, paymentId),
      ),
    )
    .orderBy(asc(billingEvent.createdAt));

  const p = found.payment;
  // A bono's payment: which bono it paid
  const [paidBono] = p.bonoId
    ? await db
        .select({
          id: bono.id,
          name: bono.name,
          serviceName: bono.serviceName,
          firstName: bono.firstName,
          lastName: bono.lastName,
          cancelled: sql<boolean>`${bono.cancelledAt} is not null`,
        })
        .from(bono)
        .where(and(eq(bono.id, p.bonoId), eq(bono.organizationId, clinicId)))
    : [];
  return {
    kind: p.kind,
    bono: paidBono ?? null,
    id: p.id,
    amountCents: p.amountCents,
    method: p.method,
    paidAt: p.paidAt,
    firstName: p.firstName,
    lastName: p.lastName,
    note: p.note,
    recordedByName: found.recordedByName,
    voided: p.voidedAt ? { at: p.voidedAt, reason: p.voidReason } : null,
    recordedById: p.recordedBy,
    // Money already given back (negative amounts)
    refunds,
    sessions,
    history: history.map((h) => ({
      action: h.data?.partial ? "refunded_partial" : h.action,
      at: h.at,
      byName: h.byName,
      reason: h.data?.reason ?? null,
    })),
  };
}
