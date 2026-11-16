import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicFeature, clinicOnlineBooking, member, physioBookingHours, user } from "../db/schema.js";
import { PROFESSIONAL_ROLES } from "./appointments.js";
import { toHHMM } from "./schedule.js";

// Reserva online (db/online-booking-schema.ts): two switches, both needed.
//   available: a super-admin switched the "online_booking" feature on
//   enabled:   the clinic's own switch (Configuración → Reserva online)
//   active:    both. The only one that decides whether patients can book
// The super-admin's switch wins: without it, `enabled` has no effect.
export async function getOnlineBookingStatus(clinicId: string) {
  const [[feature], [settings]] = await Promise.all([
    db
      .select({ feature: clinicFeature.feature })
      .from(clinicFeature)
      .where(
        and(
          eq(clinicFeature.organizationId, clinicId),
          eq(clinicFeature.feature, "online_booking"),
        ),
      )
      .limit(1),
    db
      .select({ enabled: clinicOnlineBooking.enabled })
      .from(clinicOnlineBooking)
      .where(eq(clinicOnlineBooking.organizationId, clinicId))
      .limit(1),
  ]);

  const available = !!feature;
  const enabled = settings?.enabled ?? false;
  return { available, enabled, active: available && enabled };
}

// ---------- Booking and cancellation criteria ----------

// What a clinic decides about its online bookings (Configuración → Reserva
// online). They don't apply to appointments given from the calendar
export type BookingRules = {
  // Booking: not sooner than this from now, not further than this ahead, and
  // start times offered every this many minutes
  minNoticeMinutes: number;
  maxDaysAhead: number;
  slotStepMinutes: number;
  // Cancelling: whether the patient can do it with their link, and until how
  // many hours before the appointment (0 = until it starts)
  cancelEnabled: boolean;
  cancelNoticeHours: number;
  // Free text shown to the patient when booking and in the email
  policyText: string | null;
  // Where the clinic is told about each online booking or cancellation, and
  // where the patient's replies to their confirmation email go. null = nobody
  notifyEmail: string | null;
};

// A clinic that never saved its criteria. Same as the database defaults
export const DEFAULT_BOOKING_RULES: BookingRules = {
  minNoticeMinutes: 120,
  maxDaysAhead: 60,
  slotStepMinutes: 30,
  cancelEnabled: true,
  cancelNoticeHours: 24,
  policyText: null,
  notifyEmail: null,
};

export const SLOT_STEPS = [10, 15, 20, 30, 60];
export const MAX_NOTICE_MINUTES = 14 * 24 * 60; // two weeks
export const MAX_DAYS_AHEAD = 365;
export const MAX_CANCEL_NOTICE_HOURS = 14 * 24;
export const MAX_POLICY_LENGTH = 1000;

export async function loadBookingRules(clinicId: string): Promise<BookingRules> {
  const [row] = await db
    .select({
      minNoticeMinutes: clinicOnlineBooking.minNoticeMinutes,
      maxDaysAhead: clinicOnlineBooking.maxDaysAhead,
      slotStepMinutes: clinicOnlineBooking.slotStepMinutes,
      cancelEnabled: clinicOnlineBooking.cancelEnabled,
      cancelNoticeHours: clinicOnlineBooking.cancelNoticeHours,
      policyText: clinicOnlineBooking.policyText,
      notifyEmail: clinicOnlineBooking.notifyEmail,
    })
    .from(clinicOnlineBooking)
    .where(eq(clinicOnlineBooking.organizationId, clinicId))
    .limit(1);
  return row ?? DEFAULT_BOOKING_RULES;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isIntBetween = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

// The criteria sent by the frontend, checked. A string = what's wrong
export function parseBookingRules(body: Record<string, unknown>): BookingRules | string {
  if (!isIntBetween(body.minNoticeMinutes, 0, MAX_NOTICE_MINUTES)) {
    return "La antelación mínima para reservar no es válida";
  }
  if (!isIntBetween(body.maxDaysAhead, 1, MAX_DAYS_AHEAD)) {
    return `Se puede reservar con entre 1 y ${MAX_DAYS_AHEAD} días de antelación`;
  }
  if (!SLOT_STEPS.includes(body.slotStepMinutes as number)) {
    return `El intervalo entre horas debe ser de ${SLOT_STEPS.join(", ")} minutos`;
  }
  if (typeof body.cancelEnabled !== "boolean") {
    return "Indica si los pacientes pueden cancelar online";
  }
  if (!isIntBetween(body.cancelNoticeHours, 0, MAX_CANCEL_NOTICE_HOURS)) {
    return "La antelación mínima para cancelar no es válida";
  }
  const policy = body.policyText;
  if (policy !== null && policy !== undefined && typeof policy !== "string") {
    return "El texto para el paciente no es válido";
  }
  const policyText = typeof policy === "string" && policy.trim() ? policy.trim() : null;
  if (policyText && policyText.length > MAX_POLICY_LENGTH) {
    return `El texto para el paciente puede tener como máximo ${MAX_POLICY_LENGTH} caracteres`;
  }
  const notify = body.notifyEmail;
  if (notify !== null && notify !== undefined && typeof notify !== "string") {
    return "El email de avisos no es válido";
  }
  const notifyEmail = typeof notify === "string" && notify.trim() ? notify.trim().toLowerCase() : null;
  if (notifyEmail && (notifyEmail.length > 200 || !EMAIL_PATTERN.test(notifyEmail))) {
    return "El email de avisos no es válido";
  }
  return {
    minNoticeMinutes: body.minNoticeMinutes,
    maxDaysAhead: body.maxDaysAhead,
    slotStepMinutes: body.slotStepMinutes as number,
    cancelEnabled: body.cancelEnabled,
    cancelNoticeHours: body.cancelNoticeHours,
    policyText,
    notifyEmail,
  };
}

// Can the patient still cancel this appointment themselves? The last moment is
// `cancelNoticeHours` before it starts
export function cancelDeadline(startsAt: Date, rules: BookingRules) {
  return new Date(startsAt.getTime() - rules.cancelNoticeHours * 3600_000);
}

// The clinic's professionals (who can attend appointments), each with the
// weekly slots in which they accept online bookings ("HH:MM", clinic local
// time). No slots = can't be booked online
export async function loadBookingProfessionals(clinicId: string) {
  const [professionals, hours] = await Promise.all([
    db
      .select({
        memberId: member.id,
        userId: user.id,
        name: user.name,
        image: user.image,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, clinicId), inArray(member.role, PROFESSIONAL_ROLES)))
      .orderBy(asc(user.name)),
    db
      .select({
        memberId: physioBookingHours.memberId,
        weekday: physioBookingHours.weekday,
        startTime: physioBookingHours.startTime,
        endTime: physioBookingHours.endTime,
      })
      .from(physioBookingHours)
      .where(eq(physioBookingHours.organizationId, clinicId))
      .orderBy(asc(physioBookingHours.weekday), asc(physioBookingHours.startTime)),
  ]);

  return professionals.map((p) => ({
    ...p,
    weeklyHours: hours
      .filter((h) => h.memberId === p.memberId)
      .map((h) => ({
        weekday: h.weekday,
        startTime: toHHMM(h.startTime),
        endTime: toHHMM(h.endTime),
      })),
  }));
}
