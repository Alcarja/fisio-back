import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  appointmentReminder,
  clinicFeature,
  clinicReminderSettings,
  organization,
  patient,
  service,
  user,
} from "../db/schema.js";
import { sendTemplate } from "./email/index.js";
import { logError, maskEmail } from "./logError.js";
import { getOnlineBookingStatus, loadBookingRules } from "./onlineBooking.js";
import { toHHMM } from "./schedule.js";
import { addDaysIso, utcToZoned, zonedToUtc } from "./timezone.js";

// Recordatorios de cita por email (db/reminder-schema.ts). Two switches, both
// needed, like the online booking:
//   available: a super-admin switched the "reminders" feature on
//   enabled:   the clinic's own switch (Configuración → Recordatorios)
//   active:    both
//
// Each patient of an appointment gets one, at the email that comes, in order:
//   1. from the email the clinic wrote for a patient without ficha
//   2. from their ficha
//   3. from the online booking (only appointments with a single patient)

export type ReminderSettings = {
  timing: "day_before" | "hours_before";
  sendTime: string; // "18:00", clinic local time
  hoursBefore: number;
  includeService: boolean;
  replyTo: string | null;
  extraText: string | null;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  timing: "day_before",
  sendTime: "18:00",
  hoursBefore: 24,
  includeService: false,
  replyTo: null,
  extraText: null,
};

export const MAX_HOURS_BEFORE = 72;
export const MAX_EXTRA_TEXT = 500;

export async function getReminderStatus(clinicId: string) {
  const [[feature], [row]] = await Promise.all([
    db
      .select({ feature: clinicFeature.feature })
      .from(clinicFeature)
      .where(and(eq(clinicFeature.organizationId, clinicId), eq(clinicFeature.feature, "reminders")))
      .limit(1),
    db
      .select()
      .from(clinicReminderSettings)
      .where(eq(clinicReminderSettings.organizationId, clinicId))
      .limit(1),
  ]);
  const available = !!feature;
  const enabled = row?.enabled ?? false;
  const settings: ReminderSettings = row
    ? {
        timing: row.timing as ReminderSettings["timing"],
        sendTime: toHHMM(row.sendTime),
        hoursBefore: row.hoursBefore,
        includeService: row.includeService,
        replyTo: row.replyTo,
        extraText: row.extraText,
      }
    : DEFAULT_REMINDER_SETTINGS;
  return { available, enabled, active: available && enabled, settings };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => value.length <= 200 && EMAIL_PATTERN.test(value);

// The settings sent by the frontend, checked. A string = what's wrong
export function parseReminderSettings(body: Record<string, unknown>): ReminderSettings | string {
  if (body.timing !== "day_before" && body.timing !== "hours_before") {
    return "Elige cuándo se envía el recordatorio";
  }
  if (typeof body.sendTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.sendTime)) {
    return "La hora de envío no es válida";
  }
  const hours = body.hoursBefore;
  if (!Number.isInteger(hours) || (hours as number) < 1 || (hours as number) > MAX_HOURS_BEFORE) {
    return `El recordatorio se envía entre 1 y ${MAX_HOURS_BEFORE} horas antes`;
  }
  if (typeof body.includeService !== "boolean") return "Indica si se incluye el servicio";

  const reply = typeof body.replyTo === "string" ? body.replyTo.trim().toLowerCase() : "";
  if (body.replyTo != null && typeof body.replyTo !== "string") return "El email de respuestas no es válido";
  if (reply && !isEmail(reply)) return "El email de respuestas no es válido";

  const extra = typeof body.extraText === "string" ? body.extraText.trim() : "";
  if (body.extraText != null && typeof body.extraText !== "string") return "El texto no es válido";
  if (extra.length > MAX_EXTRA_TEXT) {
    return `El texto puede tener como máximo ${MAX_EXTRA_TEXT} caracteres`;
  }

  return {
    timing: body.timing,
    sendTime: body.sendTime,
    hoursBefore: hours as number,
    includeService: body.includeService,
    replyTo: reply || null,
    extraText: extra || null,
  };
}

// When the reminder of an appointment is due
export function reminderDueAt(startsAt: Date, timeZone: string, settings: ReminderSettings) {
  if (settings.timing === "hours_before") {
    return new Date(startsAt.getTime() - settings.hoursBefore * 3600_000);
  }
  const day = utcToZoned(startsAt, timeZone).date;
  return zonedToUtc(addDaysIso(day, -1), settings.sendTime, timeZone);
}

// Is this appointment going to get (or has it got) its reminder? Only
// appointments that haven't started and still count: booked or confirmed
export const remindable = (status: string, startsAt: Date, now = new Date()) =>
  (status === "booked" || status === "confirmed") && startsAt > now;

// SQL: the email a patient of an appointment is reminded at, or null.
// Needs appointment, appointment_patient and patient (left join) in the query
export const reminderEmailSql = sql<string | null>`coalesce(
  nullif(${appointmentPatient.contactEmail}, ''),
  nullif(${patient.email}, ''),
  case when ${appointment.source} = 'online'
        and (select count(*) from appointment_patient ap2 where ap2.appointment_id = ${appointment.id}) = 1
       then nullif(${appointment.contactEmail}, '') end
)`;

// ---------- Sending ----------

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
};

// Furthest a reminder can be sent before its appointment: the longest
// "hours before", or the evening before (always under two days)
const HORIZON_HOURS = MAX_HOURS_BEFORE + 1;

// Sends the reminders that are due, in every clinic that has them active.
// Safe to run often and from several processes: each reminder is claimed in
// the database before it's sent, so it can't go out twice
export async function sendDueReminders(now = new Date()) {
  const rows = await db
    .select({
      appointmentId: appointment.id,
      clinicId: appointment.organizationId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      createdAt: appointment.createdAt,
      cancelToken: appointment.cancelToken,
      clinicName: organization.name,
      clinicSlug: organization.slug,
      timeZone: organization.timezone,
      serviceName: service.name,
      physioName: user.name,
      firstName: sql<string>`coalesce(${patient.firstName}, ${appointmentPatient.firstName})`,
      email: reminderEmailSql,
    })
    .from(appointment)
    .innerJoin(organization, eq(appointment.organizationId, organization.id))
    .innerJoin(
      clinicFeature,
      and(
        eq(clinicFeature.organizationId, appointment.organizationId),
        eq(clinicFeature.feature, "reminders"),
      ),
    )
    .innerJoin(
      clinicReminderSettings,
      and(
        eq(clinicReminderSettings.organizationId, appointment.organizationId),
        eq(clinicReminderSettings.enabled, true),
      ),
    )
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .leftJoin(user, eq(appointment.physioId, user.id))
    .innerJoin(appointmentPatient, eq(appointmentPatient.appointmentId, appointment.id))
    .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
    .where(
      and(
        inArray(appointment.status, ["booked", "confirmed"]),
        sql`${appointment.startsAt} > ${now.toISOString()}::timestamptz`,
        sql`${appointment.startsAt} < ${new Date(now.getTime() + HORIZON_HOURS * 3600_000).toISOString()}::timestamptz`,
        sql`coalesce(${organization.status}, 'active') <> 'inactive'`,
      ),
    );

  const settingsByClinic = new Map<string, Awaited<ReturnType<typeof getReminderStatus>>>();
  let sent = 0;

  for (const row of rows) {
    if (!row.email) continue;
    if (!settingsByClinic.has(row.clinicId)) {
      settingsByClinic.set(row.clinicId, await getReminderStatus(row.clinicId));
    }
    const { settings } = settingsByClinic.get(row.clinicId)!;
    const timeZone = row.timeZone ?? "Europe/Madrid";
    const dueAt = reminderDueAt(row.startsAt, timeZone, settings);
    // Not yet; or booked after its moment (they've just booked: they know)
    if (now < dueAt || row.createdAt >= dueAt) continue;

    const email = row.email.toLowerCase();
    // Claim it. Already there = sent before (or another process has it)
    const [claimed] = await db
      .insert(appointmentReminder)
      .values({
        organizationId: row.clinicId,
        appointmentId: row.appointmentId,
        email,
        startsAt: row.startsAt,
      })
      .onConflictDoNothing()
      .returning({ id: appointmentReminder.id });
    if (!claimed) continue;

    const start = utcToZoned(row.startsAt, timeZone);
    const [online, rules] = await Promise.all([
      getOnlineBookingStatus(row.clinicId),
      loadBookingRules(row.clinicId),
    ]);
    // The patient's own page (to see or cancel it): online bookings only, and
    // only while the clinic's online booking works
    const url =
      row.cancelToken && online.active
        ? `${frontendUrl}/reservar/${encodeURIComponent(row.clinicSlug)}/cita/${row.cancelToken}`
        : null;

    const ok = await sendTemplate(
      "appointmentReminder",
      email,
      {
        firstName: row.firstName,
        clinicName: row.clinicName,
        dateLabel: longDate(start.date),
        startTime: start.time,
        endTime: utcToZoned(row.endsAt, timeZone).time,
        professionalName: row.physioName,
        serviceName: settings.includeService ? row.serviceName : null,
        extraText: settings.extraText,
        url,
      },
      { name: row.clinicName, replyTo: settings.replyTo ?? rules.notifyEmail ?? undefined },
    );
    await db
      .update(appointmentReminder)
      .set({ status: ok ? "sent" : "failed" })
      .where(eq(appointmentReminder.id, claimed.id));
    if (ok) sent++;
    else logError("[reminders] not sent", new Error(`to ${maskEmail(email)}`));
  }
  return sent;
}

// Runs sendDueReminders every few minutes while the server is up. Only where
// SEND_REMINDERS=true (the production server): a laptop pointing at the same
// database must never email patients. One process at a time sends
const EVERY_MS = 5 * 60 * 1000;

export function startReminderScheduler() {
  if (process.env.SEND_REMINDERS !== "true") {
    console.log("[reminders] not sending from this server (SEND_REMINDERS is not true)");
    return;
  }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    const client = await pool.connect().catch(() => null);
    try {
      if (!client) return;
      const { rows } = await client.query<{ locked: boolean }>(
        "select pg_try_advisory_lock(hashtext('kineflow_reminders')) as locked",
      );
      if (!rows[0]?.locked) return;
      try {
        const sent = await sendDueReminders();
        if (sent > 0) console.log(`[reminders] ${sent} sent`);
      } finally {
        await client.query("select pg_advisory_unlock(hashtext('kineflow_reminders'))");
      }
    } catch (error) {
      logError("[reminders] run failed", error);
    } finally {
      client?.release();
      running = false;
    }
  };
  setTimeout(run, 30_000);
  setInterval(run, EVERY_MS);
}

// What the calendar shows for each patient of each appointment:
//   "sent" / "failed": a reminder went out (or failed) for its current time
//   "pending": it will get one
//   "missing": it won't, there's no email
//   null: reminders off, or the appointment doesn't need one (past, cancelled…)
export type ReminderState = "sent" | "failed" | "pending" | "missing" | null;

export async function loadReminderStates(
  clinicId: string,
  appointments: { id: string; status: string; startsAt: Date }[],
): Promise<Map<string, Map<string, ReminderState>>> {
  const states = new Map<string, Map<string, ReminderState>>();
  const relevant = appointments.filter((a) => remindable(a.status, a.startsAt));
  if (relevant.length === 0) return states;
  const { active } = await getReminderStatus(clinicId);
  if (!active) return states;

  const ids = relevant.map((a) => a.id);
  const [patients, reminders] = await Promise.all([
    db
      .select({
        id: appointmentPatient.id,
        appointmentId: appointmentPatient.appointmentId,
        email: reminderEmailSql,
      })
      .from(appointmentPatient)
      .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
      .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
      .where(and(eq(appointmentPatient.organizationId, clinicId), inArray(appointmentPatient.appointmentId, ids))),
    db
      .select({
        appointmentId: appointmentReminder.appointmentId,
        email: appointmentReminder.email,
        startsAt: appointmentReminder.startsAt,
        status: appointmentReminder.status,
      })
      .from(appointmentReminder)
      .where(and(eq(appointmentReminder.organizationId, clinicId), inArray(appointmentReminder.appointmentId, ids))),
  ]);

  const startsAtOf = new Map(relevant.map((a) => [a.id, a.startsAt.getTime()]));
  for (const p of patients) {
    let state: ReminderState = "missing";
    if (p.email) {
      const done = reminders.find(
        (r) =>
          r.appointmentId === p.appointmentId &&
          r.email === p.email!.toLowerCase() &&
          r.startsAt.getTime() === startsAtOf.get(p.appointmentId),
      );
      state = done?.status === "failed" ? "failed" : done ? "sent" : "pending";
    }
    if (!states.has(p.appointmentId)) states.set(p.appointmentId, new Map());
    states.get(p.appointmentId)!.set(p.id, state);
  }
  return states;
}
