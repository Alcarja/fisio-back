import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { billingEvent, bono, patient, payment, service, sessionCharge, user } from "../db/schema.js";
import { PAYMENT_METHODS, type PaymentMethod } from "./charges.js";
import { loadTimezone } from "./clinicSchedule.js";
import { utcToZoned, zonedToUtc } from "./timezone.js";

// The month's payments as a CSV for the clinic's accountant (gestoría), who
// makes the invoices from it (COBROS.md). One row per payment (one invoice)
// and one per refund (a rectifying invoice), by the day they happened.
// Voided payments are left out: they were mistakes.
//
// Made for Excel in Spanish: ";" between columns, "," for decimals, UTF-8
// with BOM so accents show right.

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bizum: "Bizum",
  transfer: "Transferencia",
  other: "Otra",
};

const HEADERS = [
  "Fecha",
  "Referencia",
  "Tipo",
  "Paciente",
  "NIF",
  "Dirección",
  "Código postal",
  "Ciudad",
  "Concepto",
  "Sesiones",
  "Profesional",
  "Forma de pago",
  "Importe",
  "Cobro original",
  "Nota",
];

// 4550 -> "45,50" · -4550 -> "-45,50"
const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

// One text cell. A cell starting with = + - @ would run as a formula when the
// file is opened in Excel (CSV injection): it gets a leading apostrophe
function text(value: string | null | undefined) {
  let v = (value ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@\t]/.test(v)) v = `'${v}`;
  return /[";]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const reference = (id: string) => id.slice(0, 8).toUpperCase();

type ExportSession = {
  chargeId: string;
  occurredAt: Date;
  firstName: string;
  lastName: string;
  serviceName: string;
  physioName: string | null;
};

// "Fisioterapia: 3 nov, 10 nov · Pilates: 12 nov (×2)"
function concept(sessions: ExportSession[], timeZone: string) {
  const byService = new Map<string, Map<string, number>>();
  for (const s of [...sessions].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    const day = new Intl.DateTimeFormat("es-ES", { timeZone, day: "numeric", month: "short" })
      .format(s.occurredAt)
      .replace(".", "");
    const days = byService.get(s.serviceName) ?? new Map<string, number>();
    days.set(day, (days.get(day) ?? 0) + 1);
    byService.set(s.serviceName, days);
  }
  return [...byService]
    .map(([name, days]) => `${name}: ${[...days].map(([d, n]) => (n > 1 ? `${d} (×${n})` : d)).join(", ")}`)
    .join(" · ");
}

// One movement of money in a month: a payment of sessions, a bono sold, or a
// refund (negative). Shared by the CSV and Cobros → Movimientos, so what the
// screen shows and what the accountant gets always match
export type Movement = {
  id: string;
  reference: string;
  kind: "sessions" | "bono" | "refund";
  paidAt: Date;
  day: string; // "YYYY-MM-DD", clinic time
  patientId: string | null;
  payer: string; // "Varios pacientes" when it was several people
  nif: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  concept: string;
  sessions: number | null;
  professionals: string;
  method: PaymentMethod;
  amountCents: number;
  refundOfId: string | null;
  bonoId: string | null;
  note: string | null;
  recordedByName: string | null;
  // Shown only when asked for (includeVoided); never in totals or the CSV
  voided: { at: Date; reason: string | null } | null;
};

export async function loadMonthMovements(
  clinicId: string,
  month: string,
  { includeVoided = false } = {},
): Promise<Movement[]> {
  const timeZone = await loadTimezone(clinicId);
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  const start = zonedToUtc(`${month}-01`, "00:00", timeZone);
  const end = zonedToUtc(`${nextMonth}-01`, "00:00", timeZone);

  // Payments and refunds of the month, with the payer's ficha
  const rows = await db
    .select({
      id: payment.id,
      patientId: payment.patientId,
      recordedByName: user.name,
      voidedAt: payment.voidedAt,
      voidReason: payment.voidReason,
      kind: payment.kind,
      amountCents: payment.amountCents,
      method: payment.method,
      paidAt: payment.paidAt,
      firstName: payment.firstName,
      lastName: payment.lastName,
      note: payment.note,
      refundOfId: payment.refundOfId,
      bonoId: payment.bonoId,
      nif: patient.nif,
      address: patient.address,
      postalCode: patient.postalCode,
      city: patient.city,
    })
    .from(payment)
    .leftJoin(patient, eq(payment.patientId, patient.id))
    .leftJoin(user, eq(payment.recordedBy, user.id))
    .where(
      and(
        eq(payment.organizationId, clinicId),
        includeVoided ? undefined : isNull(payment.voidedAt),
        gte(payment.paidAt, start),
        lt(payment.paidAt, end),
      ),
    )
    .orderBy(asc(payment.paidAt));

  // Which sessions each row is about. A payment: the ones it still pays plus
  // the ones refunded since (it was charged for all of them). A refund: the
  // ones it gave back. Both come from the history (billing_event)
  const paymentIds = [...new Set(rows.map((r) => r.refundOfId ?? r.id))];
  const refundEvents = paymentIds.length
    ? await db
        .select({ paymentId: billingEvent.entityId, data: billingEvent.data })
        .from(billingEvent)
        .where(
          and(
            eq(billingEvent.organizationId, clinicId),
            eq(billingEvent.entity, "payment"),
            inArray(billingEvent.action, ["refunded", "voided"]),
            inArray(billingEvent.entityId, paymentIds),
          ),
        )
    : [];
  const linked = paymentIds.length
    ? await db
        .select({ id: sessionCharge.id, paymentId: sessionCharge.paymentId })
        .from(sessionCharge)
        .where(and(eq(sessionCharge.organizationId, clinicId), inArray(sessionCharge.paymentId, paymentIds)))
    : [];

  const sessionsOfPayment = new Map<string, Set<string>>();
  const sessionsOfRefund = new Map<string, string[]>();
  for (const l of linked) {
    sessionsOfPayment.set(l.paymentId!, (sessionsOfPayment.get(l.paymentId!) ?? new Set()).add(l.id));
  }
  for (const e of refundEvents) {
    const ids = ((e.data?.sessions as string[] | undefined) ?? []).filter((x) => typeof x === "string");
    const set = sessionsOfPayment.get(e.paymentId) ?? new Set();
    ids.forEach((id) => set.add(id));
    sessionsOfPayment.set(e.paymentId, set);
    if (typeof e.data?.refundId === "string") sessionsOfRefund.set(e.data.refundId, ids);
  }

  const allIds = [...new Set([...sessionsOfPayment.values()].flatMap((s) => [...s]))];
  const details = allIds.length
    ? await db
        .select({
          chargeId: sessionCharge.id,
          occurredAt: sessionCharge.occurredAt,
          firstName: sql<string>`coalesce(${patient.firstName}, ${sessionCharge.firstName})`,
          lastName: sql<string>`coalesce(${patient.lastName}, ${sessionCharge.lastName})`,
          serviceName: sql<string>`coalesce(${service.name}, ${sessionCharge.serviceName}, 'Servicio eliminado')`,
          physioName: user.name,
        })
        .from(sessionCharge)
        .leftJoin(service, eq(sessionCharge.serviceId, service.id))
        .leftJoin(user, eq(sessionCharge.physioId, user.id))
        .leftJoin(patient, eq(sessionCharge.patientId, patient.id))
        .where(and(eq(sessionCharge.organizationId, clinicId), inArray(sessionCharge.id, allIds)))
    : [];
  const detailOf = new Map(details.map((d) => [d.chargeId, d]));

  // Bonos sold (and refunded) this month: what they were
  const refundedBono = new Map<string, string>(); // refund id -> bono id
  const originals = rows.filter((r) => r.refundOfId).map((r) => r.refundOfId!);
  if (originals.length) {
    const parents = await db
      .select({ id: payment.id, bonoId: payment.bonoId })
      .from(payment)
      .where(and(eq(payment.organizationId, clinicId), inArray(payment.id, originals)));
    for (const r of rows) {
      const parent = parents.find((p) => p.id === r.refundOfId);
      if (parent?.bonoId) refundedBono.set(r.id, parent.bonoId);
    }
  }
  const bonoIds = [...new Set([...rows.flatMap((r) => (r.bonoId ? [r.bonoId] : [])), ...refundedBono.values()])];
  const bonos = bonoIds.length
    ? await db
        .select({
          id: bono.id,
          name: bono.name,
          kind: bono.kind,
          serviceName: bono.serviceName,
          totalSessions: bono.totalSessions,
          sessionsPerWeek: bono.sessionsPerWeek,
          validFrom: bono.validFrom,
          validUntil: bono.validUntil,
        })
        .from(bono)
        .where(and(eq(bono.organizationId, clinicId), inArray(bono.id, bonoIds)))
    : [];
  const bonoOf = new Map(bonos.map((b) => [b.id, b]));
  // "Bono «Bono 10 fisio»: 10 sesiones de Fisioterapia" / "…: Pilates, noviembre 2026 (2 por semana)"
  const bonoConcept = (id: string) => {
    const b = bonoOf.get(id);
    if (!b) return "Bono";
    if (b.kind === "monthly") {
      const month = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${b.validFrom}T12:00:00Z`),
      );
      return `Bono «${b.name}»: ${b.serviceName}, ${month}${b.sessionsPerWeek ? ` (${b.sessionsPerWeek} por semana)` : ""}`;
    }
    return `Bono «${b.name}»: ${b.totalSessions} sesiones de ${b.serviceName}`;
  };

  const movements: Movement[] = [];
  for (const r of rows) {
    const isRefund = r.kind === "refund";
    const bonoId = r.bonoId ?? refundedBono.get(r.id) ?? null;
    const ids = bonoId
      ? []
      : isRefund
        ? (sessionsOfRefund.get(r.id) ?? [])
        : [...(sessionsOfPayment.get(r.id) ?? [])];
    const sessions = ids.flatMap((id) => (detailOf.has(id) ? [detailOf.get(id)!] : []));
    const physios = [...new Set(sessions.map((s) => s.physioName).filter(Boolean))].join(", ");
    // Several people in one payment: no single payer, their names go in the concept
    const payer = r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : "Varios pacientes";
    const people = r.firstName
      ? ""
      : ` (${[...new Set(sessions.map((s) => `${s.firstName} ${s.lastName}`))].join(", ")})`;

    movements.push({
      id: r.id,
      reference: reference(r.id),
      kind: r.kind as Movement["kind"],
      paidAt: r.paidAt,
      day: utcToZoned(r.paidAt, timeZone).date,
      patientId: r.patientId,
      payer,
      nif: r.nif,
      address: r.address,
      postalCode: r.postalCode,
      city: r.city,
      concept: bonoId ? bonoConcept(bonoId) : concept(sessions, timeZone) + people,
      sessions: bonoId ? (r.kind === "bono" ? (bonoOf.get(bonoId)?.totalSessions ?? null) : null) : sessions.length,
      professionals: physios,
      method: r.method as PaymentMethod,
      amountCents: r.amountCents,
      refundOfId: r.refundOfId,
      bonoId,
      note: r.note,
      recordedByName: r.recordedByName,
      voided: r.voidedAt ? { at: r.voidedAt, reason: r.voidReason } : null,
    });
  }
  return movements;
}

// The month's totals (voided movements never count)
export function movementTotals(movements: Movement[]) {
  const totals = { charged: 0, refunded: 0, byMethod: new Map<PaymentMethod, number>() };
  for (const m of movements) {
    if (m.voided) continue;
    if (m.kind === "refund") totals.refunded += m.amountCents;
    else totals.charged += m.amountCents;
    totals.byMethod.set(m.method, (totals.byMethod.get(m.method) ?? 0) + m.amountCents);
  }
  return totals;
}

export async function buildMonthCsv(clinicId: string, month: string) {
  const movements = await loadMonthMovements(clinicId, month);
  const lines = [HEADERS.join(";")];
  for (const m of movements) {
    lines.push(
      [
        text(m.day.split("-").reverse().join("/")),
        text(m.reference),
        text(m.kind === "refund" ? "Devolución" : m.kind === "bono" ? "Bono" : "Cobro"),
        text(m.payer),
        text(m.nif),
        text(m.address),
        text(m.postalCode),
        text(m.city),
        text(m.concept),
        m.sessions === null ? "" : String(m.sessions),
        text(m.professionals),
        text(methodLabels[m.method] ?? m.method),
        amount(m.amountCents),
        text(m.refundOfId ? reference(m.refundOfId) : ""),
        text(m.note),
      ].join(";"),
    );
  }
  const totals = movementTotals(movements);

  // Month totals below the rows (Concepto column for the label, Importe for the number)
  const total = (label: string, cents: number) => {
    const cells = Array<string>(HEADERS.length).fill("");
    cells[HEADERS.indexOf("Concepto")] = text(label);
    cells[HEADERS.indexOf("Importe")] = amount(cents);
    return cells.join(";");
  };
  lines.push("");
  lines.push(total("Total cobrado", totals.charged));
  lines.push(total("Total devuelto", totals.refunded));
  lines.push(total("Neto del mes", totals.charged + totals.refunded));
  for (const method of PAYMENT_METHODS) {
    const cents = totals.byMethod.get(method);
    if (cents) lines.push(total(`Neto en ${methodLabels[method].toLowerCase()}`, cents));
  }

  return { csv: `﻿${lines.join("\r\n")}\r\n`, count: movements.length };
}
