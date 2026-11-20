import type { Request, Response } from "express";
import { and, asc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentEvent,
  appointmentPatient,
  appointmentSeries,
  organization,
  patient,
  service,
  seriesMember,
  sessionCharge,
} from "../db/schema.js";
import { checkAppointmentRules, isPhysioOverlapError } from "../lib/appointments.js";
import { loadTimezone } from "../lib/clinicSchedule.js";
import { clinicSender, sendTemplate } from "../lib/email/index.js";
import { isIsoDate, isTime } from "../lib/schedule.js";
import { addDaysIso, isoWeekdayOf, utcToZoned, zonedToUtc } from "../lib/timezone.js";
import {
  canManageAll,
  insertAppointmentPatients,
  loadClass,
  loadFichas,
  MAX_SERIES_APPOINTMENTS,
  MAX_SERIES_DAYS,
  memberAsPatient,
  membersOn,
  notFound,
  send,
  seriesDates,
  serviceDuration,
} from "./appointment.controller.js";

// Editing or deleting a group class (COBROS.md → "Editar y eliminar clases").
//
// Only sessions from TOMORROW on change: today's and past ones are kept as
// they are (they've happened or are about to). Cancelled sessions stay in the
// history (appointments are never deleted). A paid session that gets
// cancelled goes to "a revisar" in Cobros; a bono session goes back to the
// bono by itself (lib/charges.ts, lib/bonos.ts).
//
// The same plan feeds the preview and the change, so what the clinic sees is
// what happens:
//   keep    nothing to change (or changed by hand: those aren't touched)
//   update  new time, room, physio or service, same day
//   cancel  its weekday is gone, it's after the new end, or the class is deleted
//   create  a new day (new weekday, or a later end) with the members who go then
// A day the class had before and has no session (cancelled for a holiday,
// moved by hand, skipped when created) is never filled in again.
//
// Optionally, the students hear about it by email: one email per person with
// their cancelled sessions, those that change time and the new ones.

type Series = typeof appointmentSeries.$inferSelect;

type Next = {
  serviceId: string;
  roomId: string;
  physioId: string | null;
  startTime: string;
  weekdays: number[];
  endsOn: string;
};

type Action = "keep" | "update" | "cancel" | "create";

type PlanItem = {
  date: string;
  appointmentId: string | null;
  // Its status now ("booked", "confirmed"…), for the history; null for new ones
  status: string | null;
  action: Action;
  // The session's time before and after (the same unless it changes)
  fromTime: string;
  startTime: string;
  // false: the change can't be made on that day (keeps how it was)
  ok: boolean;
  message: string | null;
  patients: number;
  // Payments or bono sessions that will need a look in Cobros
  charged: number;
  detached: boolean;
};

const DEFAULT_REASONS = { edit: "Cambio en la clase", delete: "Clase eliminada" };

// Body -> what the class becomes (or an error). Fields left out keep their value
async function parseNext(clinicId: string, series: Series, body: Record<string, unknown>, today: string) {
  const c = (body.changes ?? {}) as Record<string, unknown>;
  const next: Next = {
    serviceId: (c.serviceId as string) ?? series.serviceId,
    roomId: (c.roomId as string) ?? series.roomId,
    physioId: c.physioId === undefined ? series.physioId : ((c.physioId as string | null) || null),
    startTime: (c.startTime as string) ?? series.startTime,
    weekdays: Array.isArray(c.weekdays) ? [...new Set(c.weekdays as number[])].sort() : series.weekdays,
    endsOn: (c.endsOn as string) ?? series.endsOn,
  };
  if (typeof next.serviceId !== "string" || typeof next.roomId !== "string") {
    return { code: "INVALID_CLASS", message: "Elige servicio y sala" };
  }
  if (next.physioId !== null && typeof next.physioId !== "string") return { code: "INVALID_PHYSIO", message: "Fisio no válido" };
  if (!isTime(next.startTime)) return { code: "INVALID_DATE", message: "Hora no válida" };
  if (!next.weekdays.length || !next.weekdays.every((w) => Number.isInteger(w) && w >= 1 && w <= 7)) {
    return { code: "INVALID_WEEKDAYS", message: "Elige al menos un día de la semana" };
  }
  if (!isIsoDate(next.endsOn)) return { code: "INVALID_DATE", message: "Fecha de fin no válida" };
  const minEnd = series.startsOn > today ? series.startsOn : today;
  if (next.endsOn < minEnd) {
    return { code: "INVALID_DATE", message: "La fecha de fin no puede ser anterior a hoy ni al primer día de la clase" };
  }
  if (addDaysIso(today, MAX_SERIES_DAYS + 1) < next.endsOn) {
    return { code: "SERIES_TOO_LONG", message: "Como mucho seis meses desde hoy: amplíala más adelante" };
  }
  if (next.serviceId !== series.serviceId) {
    const [svc] = await db
      .select({ isGroup: service.isGroup })
      .from(service)
      .where(and(eq(service.id, next.serviceId), eq(service.organizationId, clinicId)));
    if (!svc) return { code: "INVALID_SERVICE", message: "Ese servicio no existe en tu clínica" };
    if (!svc.isGroup) return { code: "NOT_A_GROUP", message: "Las clases son de servicios en grupo" };
  }
  return next;
}

// The plan: what happens to each session of the class from tomorrow on
async function plan(clinicId: string, series: Series, next: Next | null, timeZone: string) {
  const now = new Date();
  const today = utcToZoned(now, timeZone).date;
  const cutoff = addDaysIso(today, 1);
  const deleting = next === null;

  const sessions = await db
    .select({
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      detached: appointment.detached,
      serviceId: appointment.serviceId,
      roomId: appointment.roomId,
      physioId: appointment.physioId,
    })
    .from(appointment)
    .where(
      and(
        eq(appointment.organizationId, clinicId),
        eq(appointment.seriesId, series.id),
        gte(appointment.startsAt, zonedToUtc(cutoff, "00:00", timeZone)),
      ),
    )
    .orderBy(asc(appointment.startsAt));
  const ids = sessions.map((s) => s.id);
  const [patientCounts, chargedCounts] = ids.length
    ? await Promise.all([
        db
          .select({ id: appointmentPatient.appointmentId, n: sql<number>`count(*)::int` })
          .from(appointmentPatient)
          .where(inArray(appointmentPatient.appointmentId, ids))
          .groupBy(appointmentPatient.appointmentId),
        db
          .select({ id: appointmentPatient.appointmentId, n: sql<number>`count(*)::int` })
          .from(sessionCharge)
          .innerJoin(appointmentPatient, eq(sessionCharge.appointmentPatientId, appointmentPatient.id))
          .where(
            and(
              inArray(appointmentPatient.appointmentId, ids),
              or(isNotNull(sessionCharge.paymentId), isNotNull(sessionCharge.bonoId)),
            ),
          )
          .groupBy(appointmentPatient.appointmentId),
      ])
    : [[], []];
  const countOf = (list: { id: string; n: number }[], id: string) => list.find((x) => x.id === id)?.n ?? 0;

  const newDuration = next && next.serviceId !== series.serviceId ? await serviceDuration(clinicId, next.serviceId) : null;
  const items: PlanItem[] = [];

  for (const s of sessions) {
    if (s.status === "cancelled") continue;
    const local = utcToZoned(s.startsAt, timeZone);
    const base = {
      date: local.date,
      appointmentId: s.id,
      status: s.status as string,
      fromTime: local.time,
      startTime: local.time,
      ok: true,
      message: null as string | null,
      patients: countOf(patientCounts, s.id),
      charged: countOf(chargedCounts, s.id),
      detached: s.detached,
    };
    // Changed by hand: only cancelled when the class is deleted or ends before
    if (s.detached) {
      const gone = deleting || local.date > next!.endsOn;
      items.push({ ...base, action: gone ? "cancel" : "keep", message: gone ? null : "Cambiada a mano: no se toca" });
      continue;
    }
    if (deleting || local.date > next!.endsOn || !next!.weekdays.includes(isoWeekdayOf(local.date))) {
      items.push({ ...base, action: "cancel" });
      continue;
    }
    const changed =
      next!.startTime !== local.time ||
      next!.roomId !== s.roomId ||
      next!.physioId !== s.physioId ||
      next!.serviceId !== s.serviceId;
    if (!changed) {
      items.push({ ...base, action: "keep" });
      continue;
    }
    const startsAt = zonedToUtc(local.date, next!.startTime, timeZone);
    const error = await checkAppointmentRules({
      clinicId,
      serviceId: next!.serviceId,
      roomId: next!.roomId,
      physioId: next!.physioId,
      date: local.date,
      startTime: next!.startTime,
      startsAt,
      patientCount: base.patients,
      excludeAppointmentId: s.id,
      classSession: true,
    });
    items.push({ ...base, action: "update", startTime: next!.startTime, ok: !error, message: error?.message ?? null });
  }

  // New days: only those the class didn't have before (see the top)
  if (next) {
    const members = await db.select().from(seriesMember).where(eq(seriesMember.seriesId, series.id));
    const wasSlot = (d: string) =>
      d >= series.startsOn && d <= series.endsOn && series.weekdays.includes(isoWeekdayOf(d));
    // Days with a session. Those cancelled by a previous edit of the class
    // don't count (shortening and then lengthening it brings them back);
    // those cancelled by hand (a holiday) do
    const cancelledIds = sessions.filter((s) => s.status === "cancelled").map((s) => s.id);
    const byEdit = cancelledIds.length
      ? new Set(
          (
            await db
              .select({ id: appointmentEvent.appointmentId })
              .from(appointmentEvent)
              .where(and(inArray(appointmentEvent.appointmentId, cancelledIds), sql`${appointmentEvent.changes} ? 'classEdit'`))
          ).map((e) => e.id),
        )
      : new Set<string>();
    const taken = new Set(sessions.filter((s) => !byEdit.has(s.id)).map((s) => utcToZoned(s.startsAt, timeZone).date));
    for (const date of seriesDates(cutoff, next.endsOn, next.weekdays)) {
      if (wasSlot(date) || taken.has(date)) continue;
      const going = membersOn(members, date).length;
      const error = await checkAppointmentRules({
        clinicId,
        serviceId: next.serviceId,
        roomId: next.roomId,
        physioId: next.physioId,
        date,
        startTime: next.startTime,
        startsAt: zonedToUtc(date, next.startTime, timeZone),
        patientCount: going,
        classSession: true,
      });
      items.push({
        date,
        appointmentId: null,
        status: null,
        action: "create",
        fromTime: next.startTime,
        startTime: next.startTime,
        ok: !error,
        message: error?.message ?? null,
        patients: going,
        charged: 0,
        detached: false,
      });
    }
  }

  items.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  return { items, today, cutoff, newDuration };
}

// ---------- Who hears about it ----------

type Line = { date: string; text: string };
type Person = { email: string | null; firstName: string; cancelled: Line[]; moved: Line[]; added: Line[] };

const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
};

// Each student affected, with their email (the one written for them, or
// their ficha's) and what changes for them. Room or physio changes alone
// aren't news for a student: only cancellations, new times and new days
async function affectedPeople(clinicId: string, series: Series, items: PlanItem[]) {
  const people = new Map<string, Person>();
  const add = (key: string, base: Omit<Person, "cancelled" | "moved" | "added">, kind: "cancelled" | "moved" | "added", line: Line) => {
    if (!people.has(key)) people.set(key, { ...base, cancelled: [], moved: [], added: [] });
    people.get(key)![kind].push(line);
  };
  const news = items.filter(
    (i) => i.ok && (i.action === "cancel" || (i.action === "update" && i.startTime !== i.fromTime)) && i.appointmentId,
  );
  if (news.length) {
    const rows = await db
      .select({
        appointmentId: appointmentPatient.appointmentId,
        patientId: appointmentPatient.patientId,
        firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName})`,
        lastName: sql<string>`coalesce(${patient.lastName}, ${appointmentPatient.lastName})`,
        email: sql<string | null>`coalesce(nullif(${appointmentPatient.contactEmail}, ''), nullif(${patient.email}, ''))`,
      })
      .from(appointmentPatient)
      .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
      .where(
        and(
          eq(appointmentPatient.organizationId, clinicId),
          inArray(
            appointmentPatient.appointmentId,
            news.map((i) => i.appointmentId!),
          ),
        ),
      );
    for (const r of rows) {
      const item = news.find((i) => i.appointmentId === r.appointmentId)!;
      const key = r.email?.toLowerCase() ?? r.patientId ?? `${r.firstName} ${r.lastName}`.toLowerCase();
      const when = longDate(item.date);
      if (item.action === "cancel") add(key, { email: r.email, firstName: r.firstName }, "cancelled", { date: item.date, text: `${when}, ${item.fromTime}` });
      else add(key, { email: r.email, firstName: r.firstName }, "moved", { date: item.date, text: `${when}: ahora a las ${item.startTime}` });
    }
  }
  const creates = items.filter((i) => i.ok && i.action === "create");
  if (creates.length) {
    const members = await db
      .select({
        member: seriesMember,
        fichaFirst: patient.firstName,
        fichaEmail: patient.email,
      })
      .from(seriesMember)
      .leftJoin(patient, eq(seriesMember.patientId, patient.id))
      .where(eq(seriesMember.seriesId, series.id));
    for (const item of creates) {
      for (const { member: m, fichaFirst, fichaEmail } of members) {
        if (!(m.fromDate <= item.date && (!m.toDate || m.toDate >= item.date))) continue;
        const email = m.contactEmail || fichaEmail || null;
        const key = email?.toLowerCase() ?? m.patientId ?? `${m.firstName} ${m.lastName}`.toLowerCase();
        add(key, { email, firstName: fichaFirst ?? m.firstName }, "added", { date: item.date, text: `${longDate(item.date)}, ${item.startTime}` });
      }
    }
  }
  return [...people.values()];
}

// ---------- Endpoints ----------

async function load(req: Request<{ classId: string }>, res: Response) {
  if (!canManageAll(req)) {
    send(res, 403, "FORBIDDEN", "Solo propietarios, administradores y recepción editan clases");
    return null;
  }
  const series = await loadClass(req);
  if (!series) {
    notFound(res);
    return null;
  }
  const clinicId = req.clinicId!;
  const timeZone = await loadTimezone(clinicId);
  const today = utcToZoned(new Date(), timeZone).date;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const deleting = body.delete === true;
  let next: Next | null = null;
  if (!deleting) {
    const parsed = await parseNext(clinicId, series, body, today);
    if ("code" in parsed) {
      send(res, 400, parsed.code, parsed.message);
      return null;
    }
    next = parsed;
  }
  const result = await plan(clinicId, series, next, timeZone);
  const creates = result.items.filter((i) => i.action === "create").length;
  if (creates > MAX_SERIES_APPOINTMENTS) {
    send(res, 400, "SERIES_TOO_LONG", `Como mucho ${MAX_SERIES_APPOINTMENTS} sesiones nuevas de una vez`);
    return null;
  }
  return { series, next, deleting, timeZone, body, ...result };
}

const summarize = (items: PlanItem[]) => ({
  keep: items.filter((i) => i.action === "keep").length,
  update: items.filter((i) => i.action === "update" && i.ok).length,
  cancel: items.filter((i) => i.action === "cancel").length,
  create: items.filter((i) => i.action === "create" && i.ok).length,
  skipped: items.filter((i) => !i.ok).length,
  charged: items.filter((i) => i.action === "cancel").reduce((n, i) => n + i.charged, 0),
});

// POST /clinic/calendar/classes/:classId/edit/preview
// body: { delete: true } | { changes: { serviceId?, roomId?, physioId?, startTime?, weekdays?, endsOn? } }
// -> { today, cutoff, sessions, summary, people: { withEmail, withoutEmail } }
export const previewClassEdit = async (req: Request<{ classId: string }>, res: Response) => {
  const ctx = await load(req, res);
  if (!ctx) return;
  const people = await affectedPeople(req.clinicId!, ctx.series, ctx.items);
  res.json({
    today: ctx.today,
    cutoff: ctx.cutoff,
    sessions: ctx.items,
    summary: summarize(ctx.items),
    people: { withEmail: people.filter((p) => p.email).length, withoutEmail: people.filter((p) => !p.email).length },
  });
};

// POST /clinic/calendar/classes/:classId/edit
// body: the preview's, plus { notify?: boolean, message?: string, reason?: string }
// -> { updated, created, cancelled, skipped, emailed }
export const applyClassEdit = async (req: Request<{ classId: string }>, res: Response) => {
  const ctx = await load(req, res);
  if (!ctx) return;
  const clinicId = req.clinicId!;
  const { series, next, deleting, timeZone, items, body, today, newDuration } = ctx;
  const userId = req.user!.id;
  const now = new Date();
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const reason = text(body.reason, 300) ?? (deleting ? DEFAULT_REASONS.delete : DEFAULT_REASONS.edit);
  const message = text(body.message, 1000);

  // Who to tell, worked out before the sessions change
  const people = body.notify === true ? await affectedPeople(clinicId, series, items) : [];

  const updated: string[] = [];
  const created: string[] = [];
  const cancelled: string[] = [];
  const skipped: { date: string; message: string }[] = items.filter((i) => !i.ok).map((i) => ({ date: i.date, message: i.message! }));
  const event = (appointmentId: string) => ({ appointmentId, organizationId: clinicId, changedBy: userId });

  const members = next ? await db.select().from(seriesMember).where(eq(seriesMember.seriesId, series.id)) : [];
  const fichas = next ? ((await loadFichas(clinicId, members.map(memberAsPatient))) ?? new Map()) : new Map();
  const duration = next ? (newDuration ?? (await serviceDuration(clinicId, series.serviceId))) : 0;

  for (const item of items.filter((i) => i.ok && i.action !== "keep")) {
    try {
      await db.transaction(async (tx) => {
        if (item.action === "cancel") {
          await tx
            .update(appointment)
            .set({ status: "cancelled", cancellationReason: reason, cancelledAt: now, updatedBy: userId })
            .where(and(eq(appointment.id, item.appointmentId!), eq(appointment.organizationId, clinicId)));
          await tx.insert(appointmentEvent).values({
            ...event(item.appointmentId!),
            type: "status_changed",
            // classEdit: cancelled by editing the class (not by hand), so a
            // later edit may put a session on that day again
            changes: { status: { from: item.status, to: "cancelled" }, classEdit: { from: null, to: true } },
          });
          return;
        }
        if (item.action === "update") {
          const [current] = await tx
            .select()
            .from(appointment)
            .where(and(eq(appointment.id, item.appointmentId!), eq(appointment.organizationId, clinicId)));
          if (!current) return;
          const startsAt = zonedToUtc(item.date, next!.startTime, timeZone);
          const length = newDuration !== null ? newDuration * 60000 : current.endsAt.getTime() - current.startsAt.getTime();
          await tx
            .update(appointment)
            .set({
              serviceId: next!.serviceId,
              roomId: next!.roomId,
              physioId: next!.physioId,
              startsAt,
              endsAt: new Date(startsAt.getTime() + length),
              updatedBy: userId,
            })
            .where(eq(appointment.id, current.id));
          const changes: Record<string, { from: unknown; to: unknown }> = {};
          if (item.fromTime !== item.startTime) changes.startTime = { from: item.fromTime, to: item.startTime };
          if (current.roomId !== next!.roomId) changes.roomId = { from: current.roomId, to: next!.roomId };
          if (current.physioId !== next!.physioId) changes.physioId = { from: current.physioId, to: next!.physioId };
          if (current.serviceId !== next!.serviceId) changes.serviceId = { from: current.serviceId, to: next!.serviceId };
          await tx.insert(appointmentEvent).values({ ...event(current.id), type: "updated", changes });
          return;
        }
        // create
        const startsAt = zonedToUtc(item.date, next!.startTime, timeZone);
        const [a] = await tx
          .insert(appointment)
          .values({
            organizationId: clinicId,
            serviceId: next!.serviceId,
            roomId: next!.roomId,
            physioId: next!.physioId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + duration * 60000),
            status: "booked",
            seriesId: series.id,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: appointment.id });
        const going = membersOn(members, item.date).map(memberAsPatient);
        await insertAppointmentPatients(tx, { clinicId, appointmentId: a!.id }, going, fichas);
        await tx.insert(appointmentEvent).values({ ...event(a!.id), type: "created" });
      });
      (item.action === "cancel" ? cancelled : item.action === "update" ? updated : created).push(item.date);
    } catch (error) {
      if (!isPhysioOverlapError(error)) throw error;
      skipped.push({ date: item.date, message: "El fisio ya tiene una cita a esa hora" });
    }
  }

  // The class remembers how it is now (future "Ampliar" uses it). Deleting
  // it ends it today (or on its first day, if it hadn't started) and marks it
  // deleted: it leaves Clases and can't be edited again
  await db
    .update(appointmentSeries)
    .set(
      deleting
        ? { endsOn: series.startsOn > today ? series.startsOn : today, deletedAt: now, deletedBy: userId }
        : {
            serviceId: next!.serviceId,
            roomId: next!.roomId,
            physioId: next!.physioId,
            startTime: next!.startTime,
            weekdays: next!.weekdays,
            endsOn: next!.endsOn,
          },
    )
    .where(eq(appointmentSeries.id, series.id));

  // Emails: only for what really happened
  let emailed = 0;
  if (people.length) {
    const [clinic] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, clinicId));
    const [svc] = await db
      .select({ name: service.name })
      .from(service)
      .where(eq(service.id, next?.serviceId ?? series.serviceId));
    // Only the days that really changed (a physio clash can skip one at the last moment)
    const keepDone = (lines: Line[], done: string[]) => lines.filter((l) => done.includes(l.date)).map((l) => l.text);
    for (const p of people) {
      if (!p.email) continue;
      const cancelledLines = keepDone(p.cancelled, cancelled);
      const movedLines = keepDone(p.moved, updated);
      const addedLines = keepDone(p.added, created);
      if (!cancelledLines.length && !movedLines.length && !addedLines.length) continue;
      const ok = await sendTemplate(
        "classChanged",
        p.email,
        {
          firstName: p.firstName,
          clinicName: clinic?.name ?? "",
          serviceName: svc?.name ?? "",
          cancelled: cancelledLines,
          moved: movedLines,
          added: addedLines,
          message,
        },
        clinicSender(clinic?.name ?? "", req.user!.email),
      );
      if (ok) emailed++;
    }
  }

  res.json({ updated, created, cancelled, skipped, emailed });
};
