import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentEvent,
  appointmentPatient,
  appointmentSeries,
  member,
  organization,
  patient,
  room,
  service,
  user,
} from "../db/schema.js";
import { appointmentIssues, isPhysioOverlapError, PROFESSIONAL_ROLES } from "../lib/appointments.js";
import { oneAtATime } from "../lib/clinicQueue.js";
import { loadExceptions, loadWeeklyHours } from "../lib/clinicSchedule.js";
import { clinicSender, sendTemplate } from "../lib/email/index.js";
import { matchPatientByEmail } from "../lib/patientMatch.js";
import {
  cancelDeadline,
  getOnlineBookingStatus,
  loadBookingProfessionals,
  loadBookingRules,
  type BookingRules,
} from "../lib/onlineBooking.js";
import { bookingWindow, loadOnlineSlots } from "../lib/onlineSlots.js";
import { isIsoDate, isTime } from "../lib/schedule.js";
import { addDaysIso, utcToZoned, zonedToUtc } from "../lib/timezone.js";

// Online booking, the patient's side (no login): what the page behind a
// clinic's link or QR needs. Anyone can call these, so: only what a patient
// must see, strict validation, a trap field for bots and a limit per IP.
// Dates and times are the clinic's local time.

type Params = { slug: string };

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s+().-]{6,30}$/;

// Longest range of dates one slots request can ask for
const MAX_SLOT_RANGE_DAYS = 31;

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

// A clinic that exists and isn't deactivated, by the slug in its link
async function findClinic(slug: string) {
  const [clinic] = await db
    .select({
      id: organization.id,
      name: organization.name,
      logo: organization.logo,
      status: organization.status,
      timezone: organization.timezone,
    })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!clinic || clinic.status === "inactive") return null;
  return { ...clinic, timezone: clinic.timezone ?? "Europe/Madrid" };
}

// The clinic of a booking link with its criteria, only if patients can book in
// it right now. Otherwise answers 404 (the same for "doesn't exist" and
// "switched off")
async function bookableClinic(req: Request<Params>, res: Response) {
  const clinic = await findClinic(req.params.slug);
  if (clinic && (await getOnlineBookingStatus(clinic.id)).active) {
    return { ...clinic, rules: await loadBookingRules(clinic.id) };
  }
  send(res, 404, "BOOKING_UNAVAILABLE", "Esta clínica no acepta reservas online");
  return null;
}

// What a patient needs to know about cancelling
const cancellationInfo = (rules: BookingRules) => ({
  cancelEnabled: rules.cancelEnabled,
  cancelNoticeHours: rules.cancelNoticeHours,
  policyText: rules.policyText,
});

// 24 -> "24 horas", 1 -> "1 hora", 48 -> "2 días"
const hoursLabel = (hours: number) =>
  hours % 24 === 0 && hours >= 48
    ? `${hours / 24} días`
    : `${hours} ${hours === 1 ? "hora" : "horas"}`;

const longDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
};

// GET /public/booking/:slug
// -> { clinic: { name, logo }, services, professionals, today, lastDate,
//      cancellation: { cancelEnabled, cancelNoticeHours, policyText } }
// professionals: only those open to online bookings. Their id is the member id
export const getPublicBooking = async (req: Request<Params>, res: Response) => {
  const clinic = await bookableClinic(req, res);
  if (!clinic) return;

  const [services, professionals] = await Promise.all([
    db
      .select({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
      })
      .from(service)
      .where(
        and(
          eq(service.organizationId, clinic.id),
          eq(service.isActive, true),
          eq(service.isGroup, false),
        ),
      )
      .orderBy(asc(service.name)),
    loadBookingProfessionals(clinic.id),
  ]);
  // Group classes with sessions that can still be booked (R3)
  const classSessions = await loadClassSessions(clinic);
  const classes = [...new Map(classSessions.map((s) => [s.serviceId, s])).values()].map((s) => ({
    id: s.serviceId,
    name: s.serviceName,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
  }));

  res.json({
    clinic: { name: clinic.name, logo: clinic.logo },
    services,
    classes,
    professionals: professionals
      .filter((p) => p.weeklyHours.length > 0)
      .map((p) => ({ id: p.memberId, name: p.name, image: p.image })),
    ...bookingWindow(clinic.timezone, clinic.rules),
    cancellation: cancellationInfo(clinic.rules),
  });
};

// GET /public/booking/:slug/slots?serviceId=&from=YYYY-MM-DD&to=YYYY-MM-DD&professionalId=
// -> { days: [{ date, times: ["09:00", …] }] }   (both dates included)
// Without professionalId: times at which anyone is free
export const getPublicSlots = async (req: Request<Params>, res: Response) => {
  const clinic = await bookableClinic(req, res);
  if (!clinic) return;

  const { serviceId, from, to, professionalId } = req.query;
  if (typeof serviceId !== "string" || !UUID_PATTERN.test(serviceId)) {
    return send(res, 400, "INVALID_SERVICE", "Elige un servicio");
  }
  if (professionalId !== undefined && typeof professionalId !== "string") {
    return send(res, 400, "INVALID_PROFESSIONAL", "Ese profesional no es válido");
  }
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
    return send(res, 400, "INVALID_RANGE", "from y to deben ser fechas AAAA-MM-DD, y to no anterior a from");
  }
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_SLOT_RANGE_DAYS) {
    return send(res, 400, "RANGE_TOO_LONG", `Como máximo ${MAX_SLOT_RANGE_DAYS} días por consulta`);
  }

  // Only dates that can be booked: from today to the last bookable date
  const { today, lastDate } = bookingWindow(clinic.timezone, clinic.rules);
  const first = from < today ? today : from;
  const last = to > lastDate ? lastDate : to;
  if (last < first) {
    res.json({ days: [] });
    return;
  }

  const result = await loadOnlineSlots({
    clinicId: clinic.id,
    serviceId,
    rules: clinic.rules,
    from: first,
    to: last,
    memberId: professionalId || undefined,
  });
  if (!result) return send(res, 400, "INVALID_SERVICE", "Ese servicio no se puede reservar online");

  res.json({
    days: [...result.days].map(([date, slots]) => ({ date, times: slots.map((s) => s.time) })),
  });
};

// ---------- Limit per IP (in memory: enough for one server process) ----------

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 10;
const attempts = new Map<string, number[]>();

function tooMany(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  // Forget IPs that went quiet, so the map doesn't grow forever
  if (attempts.size > 5000) {
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= WINDOW_MS)) attempts.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

// Trimmed text, or null if empty or not text. undefined if it's too long
function text(value: unknown, max: number): string | null | undefined {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed || null;
}

const SLOT_TAKEN = "Esa hora ya no está libre. Elige otra, por favor.";

// POST /public/booking/:slug/appointments -> 201 { booking }
// body: { serviceId, date, time, professionalId?, firstName, lastName, phone,
//         email, notes?, consent: true, website? }
// Without professionalId, someone free at that time is assigned. The room is
// always assigned here. "website" is the trap: hidden in the form, only bots
// fill it in
export const createPublicBooking = async (req: Request<Params>, res: Response) => {
  const clinic = await bookableClinic(req, res);
  if (!clinic) return;
  const body = req.body ?? {};

  // Bots get an answer that looks fine, but nothing is saved
  if (typeof body.website === "string" && body.website.trim() !== "") {
    res.status(201).json({ booking: null });
    return;
  }

  const { serviceId, date, time, professionalId } = body;
  if (typeof serviceId !== "string" || !UUID_PATTERN.test(serviceId)) {
    return send(res, 400, "INVALID_SERVICE", "Elige un servicio");
  }
  if (!isIsoDate(date) || !isTime(time)) {
    return send(res, 400, "INVALID_DATE", "Elige un día y una hora");
  }
  if (professionalId !== undefined && professionalId !== null && typeof professionalId !== "string") {
    return send(res, 400, "INVALID_PROFESSIONAL", "Ese profesional no es válido");
  }

  const firstName = text(body.firstName, 100);
  const lastName = text(body.lastName, 100);
  const phone = text(body.phone, 30);
  const email = text(body.email, 200)?.toLowerCase();
  const notes = text(body.notes, 500);
  if (!firstName || !lastName) {
    return send(res, 400, "INVALID_NAME", "Escribe tu nombre y tus apellidos");
  }
  if (!phone || !PHONE_PATTERN.test(phone)) {
    return send(res, 400, "INVALID_PHONE", "El teléfono no es válido");
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    return send(res, 400, "INVALID_EMAIL", "El email no es válido");
  }
  if (notes === undefined) {
    return send(res, 400, "INVALID_NOTES", "El comentario puede tener como máximo 500 caracteres");
  }
  if (body.consent !== true) {
    return send(res, 400, "CONSENT_REQUIRED", "Tienes que aceptar el tratamiento de tus datos");
  }

  const { today, lastDate } = bookingWindow(clinic.timezone, clinic.rules);
  if (date < today || date > lastDate) {
    return send(res, 409, "SLOT_TAKEN", SLOT_TAKEN);
  }

  if (tooMany(req.ip ?? "unknown")) {
    return send(
      res,
      429,
      "TOO_MANY_REQUESTS",
      "Has hecho varias reservas seguidas. Inténtalo dentro de un rato o llama a la clínica.",
    );
  }

  try {
    const booked = await oneAtATime(clinic.id, async () => {
      // Checked again now: the page's slots may be minutes old.
      // Read BEFORE opening the transaction: these queries use other
      // connections of the pool, and a transaction waiting for them while it
      // holds one would leave the pool empty with enough bookings at once
      const result = await loadOnlineSlots({
        clinicId: clinic.id,
        serviceId,
        rules: clinic.rules,
        from: date,
        to: date,
        memberId: professionalId || undefined,
      });
      const slot = result?.days.get(date)?.find((s) => s.time === time);
      if (!result || !slot) return null;

      // No preference: any of those free, so bookings spread between them
      const professional =
        slot.professionals[Math.floor(Math.random() * slot.professionals.length)]!;

      // The key of the patient's own link to see and cancel this appointment
      const cancelToken = randomBytes(24).toString("base64url");

      // Everything inside uses the transaction's own connection
      return db.transaction(async (tx) => {
        // Second lock, for when several server processes share the database:
        // one online booking at a time per clinic there too
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinic.id}))`);

        // The room, checked once more now that nobody else can book online:
        // people already in it while this appointment and its cleaning time last
        const roomBusyUntil = new Date(
          slot.endsAt.getTime() + result.service.bufferMinutes * 60000,
        );
        const inRoom = await tx.execute<{ people: number }>(sql`
          select count(ap.id)::int as people
          from appointment a
          join service sv on sv.id = a.service_id
          left join appointment_patient ap on ap.appointment_id = a.id
          where a.room_id = ${slot.roomId}
            and a.status <> 'cancelled'
            and a.starts_at < ${roomBusyUntil.toISOString()}::timestamptz
            and a.ends_at + sv.buffer_minutes * interval '1 minute' > ${slot.startsAt.toISOString()}::timestamptz
        `);
        if ((inRoom.rows[0]?.people ?? 0) + 1 > slot.roomCapacity) return null;

        // The professional is guarded by the database itself
        // (appointment_physio_no_overlap): a clash makes this insert fail
        const [created] = await tx
          .insert(appointment)
          .values({
            organizationId: clinic.id,
            serviceId,
            roomId: slot.roomId,
            physioId: professional.userId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            status: "booked",
            notes,
            source: "online",
            contactPhone: phone,
            contactEmail: email,
            cancelToken,
          })
          .returning({ id: appointment.id });

        // Their ficha, if email and name match one (lib/patientMatch.ts).
        // Linked: the ficha's names. Not: what they typed, and maybe a
        // suggestion for the clinic
        const match = await matchPatientByEmail(tx, clinic.id, { email, firstName, lastName });
        await tx.insert(appointmentPatient).values({
          appointmentId: created!.id,
          organizationId: clinic.id,
          ...(match.linked
            ? {
                patientId: match.linked.id,
                firstName: match.linked.firstName,
                lastName: match.linked.lastName,
              }
            : { firstName, lastName, suggestedPatientId: match.suggestedId }),
        });
        // changedBy stays empty: nobody from the clinic created it
        await tx.insert(appointmentEvent).values({
          appointmentId: created!.id,
          organizationId: clinic.id,
          type: "created",
        });

        return { slot, professional, serviceName: result.service.name, cancelToken };
      });
    });

    if (!booked) return send(res, 409, "SLOT_TAKEN", SLOT_TAKEN);

    const endTime = utcToZoned(booked.slot.endsAt, clinic.timezone).time;
    const { rules } = clinic;

    // Emails go out in the background (sendTemplate never throws): the patient
    // doesn't wait for the email provider to see their confirmation.
    // To the patient, in the clinic's name. The page shows the same details
    // and the same link, in case it doesn't arrive
    void sendTemplate(
      "bookingConfirmation",
      email,
      {
        firstName,
        clinicName: clinic.name,
        serviceName: booked.serviceName,
        professionalName: booked.professional.name,
        dateLabel: longDate(date),
        startTime: time,
        endTime,
        url: `${frontendUrl}/reservar/${encodeURIComponent(req.params.slug)}/cita/${booked.cancelToken}`,
        cancelNote: !rules.cancelEnabled
          ? null
          : rules.cancelNoticeHours === 0
            ? "Si no puedes venir, puedes cancelar la cita desde el enlace hasta su hora de inicio."
            : `Si no puedes venir, puedes cancelar la cita desde el enlace hasta ${hoursLabel(rules.cancelNoticeHours)} antes.`,
        policyText: rules.policyText,
      },
      // Answers go to the clinic's notices address, if it has one
      { name: clinic.name, replyTo: rules.notifyEmail ?? undefined },
    );

    // To the clinic, if it wants notices. Answering writes to the patient
    if (rules.notifyEmail) {
      void sendTemplate(
        "bookingNotice",
        rules.notifyEmail,
        {
          kind: "booked",
          clinicName: clinic.name,
          patientName: `${firstName} ${lastName}`,
          phone,
          email,
          serviceName: booked.serviceName,
          professionalName: booked.professional.name,
          dateLabel: longDate(date),
          startTime: time,
          endTime,
          hasNotes: !!notes,
          url: `${frontendUrl}/admin/bookings`,
        },
        { name: `${clinic.name} · Reservas`, replyTo: email },
      );
    }

    res.status(201).json({
      booking: {
        // For the link to the patient's own page (/reservar/:slug/cita/:token)
        token: booked.cancelToken,
        clinicName: clinic.name,
        serviceName: booked.serviceName,
        professionalName: booked.professional.name,
        date,
        startTime: time,
        endTime,
      },
    });
  } catch (error) {
    // The clinic gave that professional another appointment at the same moment
    if (isPhysioOverlapError(error)) return send(res, 409, "SLOT_TAKEN", SLOT_TAKEN);
    throw error;
  }
};

// ---------- The patient's own appointment (the link they get when booking) ----------

type TokenParams = { slug: string; token: string };

const BOOKING_NOT_FOUND = "No encontramos esta cita. Revisa el enlace o llama a la clínica.";

// An online appointment by the key in the patient's link, with what the page
// shows and whether it can still be cancelled online.
// These keep working if the clinic later switches online booking off: the
// appointment still exists and the patient must be able to see and cancel it
async function loadPatientBooking(slug: string, token: string) {
  // Keys are 32 url-safe characters: anything else can't be one
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const clinic = await findClinic(slug);
  if (!clinic) return null;

  const columns = {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    notes: appointment.notes,
    contactPhone: appointment.contactPhone,
    contactEmail: appointment.contactEmail,
    serviceName: service.name,
    professionalName: user.name,
  };
  // An individual appointment (its key is on the appointment)…
  const [own] = await db
    .select(columns)
    .from(appointment)
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .leftJoin(user, eq(appointment.physioId, user.id))
    .where(and(eq(appointment.cancelToken, token), eq(appointment.organizationId, clinic.id)))
    .limit(1);
  // …or a place in a class session (the key is on the participant)
  const [place] = own
    ? []
    : await db
        .select({
          ...columns,
          placeId: appointmentPatient.id,
          placeName: sql<string>`${appointmentPatient.firstName} || ' ' || ${appointmentPatient.lastName}`,
          placePhone: appointmentPatient.contactPhone,
          placeEmail: appointmentPatient.contactEmail,
        })
        .from(appointmentPatient)
        .innerJoin(appointment, eq(appointmentPatient.appointmentId, appointment.id))
        .innerJoin(service, eq(appointment.serviceId, service.id))
        .leftJoin(user, eq(appointment.physioId, user.id))
        .where(and(eq(appointmentPatient.cancelToken, token), eq(appointmentPatient.organizationId, clinic.id)))
        .limit(1);
  const row = own
    ? { ...own, placeId: null as string | null, placeName: null as string | null }
    : place
      ? { ...place, contactPhone: place.placePhone, contactEmail: place.placeEmail }
      : null;
  if (!row) return null;

  const rules = await loadBookingRules(clinic.id);
  const now = new Date();
  const deadline = cancelDeadline(row.startsAt, rules);
  // Why it can't be cancelled online, or null if it can
  const cancelBlocked =
    row.status === "cancelled"
      ? ("ALREADY_CANCELLED" as const)
      : row.status !== "booked" && row.status !== "confirmed"
        ? ("FINISHED" as const)
        : row.startsAt <= now
          ? ("FINISHED" as const)
          : !rules.cancelEnabled
            ? ("NOT_ALLOWED" as const)
            : now > deadline
              ? ("TOO_LATE" as const)
              : null;

  const start = utcToZoned(row.startsAt, clinic.timezone);
  return {
    clinic,
    rules,
    row,
    cancelBlocked,
    booking: {
      clinicName: clinic.name,
      serviceName: row.serviceName,
      professionalName: row.professionalName,
      date: start.date,
      startTime: start.time,
      endTime: utcToZoned(row.endsAt, clinic.timezone).time,
      cancelled: row.status === "cancelled",
      canCancel: cancelBlocked === null,
      // "ALREADY_CANCELLED" | "FINISHED" | "NOT_ALLOWED" | "TOO_LATE" | null
      cancelBlocked,
      cancellation: cancellationInfo(rules),
    },
  };
}

// GET /public/booking/:slug/appointments/:token -> { booking }
export const getPublicAppointment = async (req: Request<TokenParams>, res: Response) => {
  const found = await loadPatientBooking(req.params.slug, req.params.token);
  if (!found) return send(res, 404, "BOOKING_NOT_FOUND", BOOKING_NOT_FOUND);
  res.json({ booking: found.booking });
};

// POST /public/booking/:slug/appointments/:token/cancel -> { booking }
// Only inside the clinic's cancellation criteria. The appointment stays in the
// calendar as cancelled, with its history, and its time is free again
export const cancelPublicAppointment = async (req: Request<TokenParams>, res: Response) => {
  const found = await loadPatientBooking(req.params.slug, req.params.token);
  if (!found) return send(res, 404, "BOOKING_NOT_FOUND", BOOKING_NOT_FOUND);

  const { row, rules, cancelBlocked } = found;
  if (cancelBlocked === "ALREADY_CANCELLED") {
    res.json({ booking: found.booking });
    return;
  }
  if (cancelBlocked) {
    return send(
      res,
      409,
      `CANCEL_${cancelBlocked}`,
      cancelBlocked === "TOO_LATE"
        ? `Solo se puede cancelar online hasta ${hoursLabel(rules.cancelNoticeHours)} antes de la cita. Llama a la clínica.`
        : cancelBlocked === "NOT_ALLOWED"
          ? "Esta clínica no permite cancelar online. Llama a la clínica."
          : "Esta cita ya ha pasado.",
    );
  }

  await db.transaction(async (tx) => {
    if (row.placeId) {
      // A place in a class: they leave that session, the session stays
      await tx.delete(appointmentPatient).where(eq(appointmentPatient.id, row.placeId));
      await tx.insert(appointmentEvent).values({
        appointmentId: row.id,
        organizationId: found.clinic.id,
        type: "patients_changed",
        changes: { onlineCancel: { from: row.placeName, to: null } },
      });
      return;
    }
    await tx
      .update(appointment)
      .set({
        status: "cancelled",
        cancellationReason: "Cancelada por el paciente (online)",
        cancelledAt: new Date(),
      })
      .where(eq(appointment.id, row.id));
    // changedBy stays empty: nobody from the clinic did it
    await tx.insert(appointmentEvent).values({
      appointmentId: row.id,
      organizationId: found.clinic.id,
      type: "status_changed",
      changes: { status: { from: row.status, to: "cancelled" } },
    });
  });

  // To the clinic, if it wants notices: the time is free again
  if (rules.notifyEmail) {
    const patients = row.placeName
      ? [{ firstName: row.placeName, lastName: "" }]
      : await db
      .select({ firstName: appointmentPatient.firstName, lastName: appointmentPatient.lastName })
      .from(appointmentPatient)
      .where(eq(appointmentPatient.appointmentId, row.id));
    void sendTemplate(
      "bookingNotice",
      rules.notifyEmail,
      {
        kind: "cancelled",
        clinicName: found.clinic.name,
        patientName: patients.map((p) => `${p.firstName} ${p.lastName}`).join(", ") || "Paciente",
        phone: row.contactPhone,
        email: row.contactEmail,
        serviceName: row.serviceName,
        professionalName: row.professionalName ?? "",
        dateLabel: longDate(found.booking.date),
        startTime: found.booking.startTime,
        endTime: found.booking.endTime,
        hasNotes: false,
        url: `${frontendUrl}/admin/bookings`,
      },
      { name: `${found.clinic.name} · Reservas`, replyTo: row.contactEmail ?? undefined },
    );
  }

  res.json({
    booking: { ...found.booking, cancelled: true, canCancel: false, cancelBlocked: "ALREADY_CANCELLED" },
  });
};

// ---------- Group classes (book a place in a session) ----------

type BookableClinic = NonNullable<Awaited<ReturnType<typeof bookableClinic>>>;

// The class sessions that can be booked online now: sessions of the clinic's
// classes (R3), not cancelled, inside the booking window (notice and days
// ahead), of active group services. placesLeft: free places in the session
async function loadClassSessions(clinic: BookableClinic, filter: { serviceId?: string; sessionId?: string } = {}) {
  const { lastDate } = bookingWindow(clinic.timezone, clinic.rules);
  const from = new Date(Date.now() + clinic.rules.minNoticeMinutes * 60000);
  const until = zonedToUtc(addDaysIso(lastDate, 1), "00:00", clinic.timezone);
  // Counts below name "appointment"."id" in full: in a query on one table
  // Drizzle writes columns without their table, and inside the subquery a bare
  // "id" would be the patient row's
  const rows = await db
    .select({
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      roomId: appointment.roomId,
      physioId: appointment.physioId,
      serviceId: service.id,
      serviceName: service.name,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      maxPatients: service.maxPatients,
      serviceRoomTypeId: service.roomTypeId,
      roomCapacity: room.capacity,
      roomIsActive: room.isActive,
      roomTypeId: room.roomTypeId,
      professionalName: user.name,
      taken: sql<number>`(select count(*)::int from appointment_patient ap where ap.appointment_id = "appointment"."id")`,
    })
    .from(appointment)
    .innerJoin(appointmentSeries, eq(appointment.seriesId, appointmentSeries.id))
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .innerJoin(room, eq(appointment.roomId, room.id))
    .leftJoin(user, eq(appointment.physioId, user.id))
    .where(
      and(
        eq(appointment.organizationId, clinic.id),
        eq(appointmentSeries.kind, "class"),
        // A deleted class keeps today's session for those already in it,
        // but it's no longer offered online
        isNull(appointmentSeries.deletedAt),
        inArray(appointment.status, ["booked", "confirmed"]),
        eq(service.isActive, true),
        eq(service.isGroup, true),
        gte(appointment.startsAt, from),
        lt(appointment.startsAt, until),
        filter.serviceId ? eq(service.id, filter.serviceId) : undefined,
        filter.sessionId ? eq(appointment.id, filter.sessionId) : undefined,
      ),
    )
    .orderBy(asc(appointment.startsAt));
  if (rows.length === 0) return [];

  // The same checks as the calendar's warnings: a session that no longer fits
  // the clinic (closed that day, outside hours, room deactivated or of another
  // type) isn't offered, and its places count everyone in the room at the time
  // (other appointments there too)
  const dates = rows.map((r) => utcToZoned(r.startsAt, clinic.timezone).date).sort();
  const [weeklyHours, exceptions, team, others] = await Promise.all([
    loadWeeklyHours(clinic.id),
    loadExceptions(clinic.id, { from: dates[0], to: dates.at(-1) }),
    db
      .select({ userId: member.userId })
      .from(member)
      .where(and(eq(member.organizationId, clinic.id), inArray(member.role, PROFESSIONAL_ROLES))),
    db
      .select({
        id: appointment.id,
        roomId: appointment.roomId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        patientCount: sql<number>`(select count(*)::int from appointment_patient ap where ap.appointment_id = "appointment"."id")`,
      })
      .from(appointment)
      .where(
        and(
          eq(appointment.organizationId, clinic.id),
          inArray(appointment.roomId, [...new Set(rows.map((r) => r.roomId))]),
          sql`${appointment.status} <> 'cancelled'`,
          lt(appointment.startsAt, rows.at(-1)!.endsAt),
          gte(appointment.endsAt, rows[0]!.startsAt),
        ),
      ),
  ]);
  const professionalIds = new Set(team.map((t) => t.userId));
  const BLOCKING = new Set(["CLINIC_CLOSED", "OUTSIDE_HOURS", "ROOM_INACTIVE", "SERVICE_INACTIVE", "WRONG_ROOM_TYPE"]);

  return rows.flatMap((r) => {
    const start = utcToZoned(r.startsAt, clinic.timezone);
    const issues = appointmentIssues(
      {
        date: start.date,
        startTime: start.time,
        durationMinutes: Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        patientCount: r.taken,
        roomId: r.roomId,
        roomIsActive: r.roomIsActive,
        roomCapacity: r.roomCapacity,
        roomTypeId: r.roomTypeId,
        serviceIsActive: true,
        serviceRoomTypeId: r.serviceRoomTypeId,
        serviceMaxPatients: r.maxPatients,
        physioId: r.physioId,
      },
      { weeklyHours, exceptions, professionalIds, others: [] },
    );
    if (issues.some((i) => BLOCKING.has(i.code))) return [];
    const inRoom = others
      .filter((o) => o.id !== r.id && o.roomId === r.roomId && o.startsAt < r.endsAt && o.endsAt > r.startsAt)
      .reduce((sum, o) => sum + o.patientCount, 0);
    return [
      {
        ...r,
        // Someone no longer in the team isn't named
        professionalName: r.physioId && professionalIds.has(r.physioId) ? r.professionalName : null,
        placesLeft: Math.max(0, Math.min(r.maxPatients - r.taken, r.roomCapacity - r.taken - inRoom)),
      },
    ];
  });
}

// GET /public/booking/:slug/classes?serviceId= -> { sessions }
// The upcoming sessions of a class, with the places left (0 = full)
export const getPublicClassSessions = async (req: Request<Params>, res: Response) => {
  const clinic = await bookableClinic(req, res);
  if (!clinic) return;
  const { serviceId } = req.query;
  if (typeof serviceId !== "string" || !UUID_PATTERN.test(serviceId)) {
    return send(res, 400, "INVALID_SERVICE", "Elige una clase");
  }
  const sessions = await loadClassSessions(clinic, { serviceId });
  res.json({
    sessions: sessions.map((s) => {
      const start = utcToZoned(s.startsAt, clinic.timezone);
      return {
        id: s.id,
        date: start.date,
        startTime: start.time,
        endTime: utcToZoned(s.endsAt, clinic.timezone).time,
        professionalName: s.professionalName,
        placesLeft: s.placesLeft,
      };
    }),
  });
};

// POST /public/booking/:slug/classes/:sessionId -> 201 { booking }
// body: { firstName, lastName, phone, email, consent: true, website? }
// Books one place in a class session. Linked to the patient's ficha when email
// and name match one (lib/patientMatch.ts); the answer never says so
export const bookPublicClass = async (req: Request<Params & { sessionId: string }>, res: Response) => {
  const clinic = await bookableClinic(req, res);
  if (!clinic) return;
  const body = req.body ?? {};
  if (typeof body.website === "string" && body.website.trim() !== "") {
    res.status(201).json({ booking: null });
    return;
  }
  if (!UUID_PATTERN.test(req.params.sessionId)) return send(res, 409, "CLASS_UNAVAILABLE", CLASS_UNAVAILABLE);
  const firstName = text(body.firstName, 100);
  const lastName = text(body.lastName, 100);
  const phone = text(body.phone, 30);
  const email = text(body.email, 200)?.toLowerCase();
  if (!firstName || !lastName) return send(res, 400, "INVALID_NAME", "Escribe tu nombre y tus apellidos");
  if (!phone || !PHONE_PATTERN.test(phone)) return send(res, 400, "INVALID_PHONE", "El teléfono no es válido");
  if (!email || !EMAIL_PATTERN.test(email)) return send(res, 400, "INVALID_EMAIL", "El email no es válido");
  if (body.consent !== true) {
    return send(res, 400, "CONSENT_REQUIRED", "Tienes que aceptar el tratamiento de tus datos");
  }
  if (tooMany(req.ip ?? "unknown")) {
    return send(res, 429, "TOO_MANY_REQUESTS", "Has hecho varias reservas seguidas. Inténtalo dentro de un rato o llama a la clínica.");
  }

  const result = await oneAtATime(clinic.id, async () => {
    // Checked again now, one booking at a time: still bookable, with a place
    const [session] = await loadClassSessions(clinic, { sessionId: req.params.sessionId });
    if (!session) return { error: "CLASS_UNAVAILABLE" as const };
    if (session.placesLeft < 1) return { error: "CLASS_FULL" as const };

    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinic.id}))`);
      // The same person twice in a session (by the email they booked with, or
      // their ficha's): once is enough
      const already = await tx
        .select({ id: appointmentPatient.id })
        .from(appointmentPatient)
        .leftJoin(patient, eq(appointmentPatient.patientId, patient.id))
        .where(
          and(
            eq(appointmentPatient.appointmentId, session.id),
            sql`(lower(${appointmentPatient.contactEmail}) = ${email} or lower(trim(${patient.email})) = ${email})`,
            sql`lower(coalesce(${patient.firstName}, ${appointmentPatient.firstName})) = ${firstName.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (already.length) return { error: "ALREADY_BOOKED" as const };
      const [{ taken }] = (
        await tx.execute<{ taken: number }>(
          sql`select count(*)::int as taken from appointment_patient where appointment_id = ${session.id}`,
        )
      ).rows as [{ taken: number }];
      if (taken >= Math.min(session.maxPatients, session.roomCapacity)) return { error: "CLASS_FULL" as const };

      const match = await matchPatientByEmail(tx, clinic.id, { email, firstName, lastName });
      const cancelToken = randomBytes(24).toString("base64url");
      await tx.insert(appointmentPatient).values({
        appointmentId: session.id,
        organizationId: clinic.id,
        ...(match.linked
          ? { patientId: match.linked.id, firstName: match.linked.firstName, lastName: match.linked.lastName }
          : { firstName, lastName, contactEmail: email, suggestedPatientId: match.suggestedId }),
        contactPhone: phone,
        cancelToken,
      });
      await tx.insert(appointmentEvent).values({
        appointmentId: session.id,
        organizationId: clinic.id,
        type: "patients_changed",
        changes: { onlineBooking: { from: null, to: `${firstName} ${lastName}` } },
      });
      return { session, cancelToken };
    });
  });

  if ("error" in result) {
    const messages = {
      CLASS_UNAVAILABLE: CLASS_UNAVAILABLE,
      CLASS_FULL: "Esta sesión se acaba de completar. Elige otra.",
      ALREADY_BOOKED: "Ya tienes plaza en esta sesión. Revisa tu email.",
    };
    const code = result.error as keyof typeof messages;
    return send(res, 409, code, messages[code]);
  }

  const { session, cancelToken } = result as Exclude<typeof result, { error: string }>;
  const start = utcToZoned(session.startsAt, clinic.timezone);
  const endTime = utcToZoned(session.endsAt, clinic.timezone).time;
  const { rules } = clinic;
  void sendTemplate(
    "bookingConfirmation",
    email,
    {
      firstName,
      clinicName: clinic.name,
      serviceName: session.serviceName,
      professionalName: session.professionalName,
      dateLabel: longDate(start.date),
      startTime: start.time,
      endTime,
      url: `${frontendUrl}/reservar/${encodeURIComponent(req.params.slug)}/cita/${cancelToken}`,
      cancelNote: !rules.cancelEnabled
        ? null
        : rules.cancelNoticeHours === 0
          ? "Si no puedes venir, puedes cancelar tu plaza desde el enlace hasta su hora de inicio."
          : `Si no puedes venir, puedes cancelar tu plaza desde el enlace hasta ${hoursLabel(rules.cancelNoticeHours)} antes.`,
      policyText: rules.policyText,
    },
    { name: clinic.name, replyTo: rules.notifyEmail ?? undefined },
  );
  if (rules.notifyEmail) {
    void sendTemplate(
      "bookingNotice",
      rules.notifyEmail,
      {
        kind: "booked",
        clinicName: clinic.name,
        patientName: `${firstName} ${lastName}`,
        phone,
        email,
        serviceName: session.serviceName,
        professionalName: session.professionalName,
        dateLabel: longDate(start.date),
        startTime: start.time,
        endTime,
        hasNotes: false,
        url: `${frontendUrl}/admin/bookings`,
      },
      { name: `${clinic.name} · Reservas`, replyTo: email },
    );
  }
  res.status(201).json({
    booking: {
      token: cancelToken,
      clinicName: clinic.name,
      serviceName: session.serviceName,
      professionalName: session.professionalName,
      date: start.date,
      startTime: start.time,
      endTime,
    },
  });
};

const CLASS_UNAVAILABLE = "Esta sesión ya no se puede reservar online. Elige otra o llama a la clínica.";
