import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicOnlineBooking, member, physioBookingHours } from "../db/schema.js";
import { PROFESSIONAL_ROLES } from "../lib/appointments.js";
import { loadWeeklyHours } from "../lib/clinicSchedule.js";
import {
  getOnlineBookingStatus,
  loadBookingProfessionals,
  loadBookingRules,
  parseBookingRules,
} from "../lib/onlineBooking.js";
import { weeklyHoursError, type WeeklySlot } from "../lib/schedule.js";

// Configuración → Reserva online of the active clinic (owners and admins).
// Every route also needs the "online_booking" feature (requireFeature): the
// super-admin's switch comes first, the clinic's own switch is managed here.

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

// GET /clinic/settings/online-booking
// -> { enabled, rules, clinicHours,
//      professionals: [{ memberId, userId, name, image, role, weeklyHours }] }
// rules: the booking and cancellation criteria (BookingRules)
// clinicHours: the clinic's weekly hours, to warn about slots outside them
export const getOnlineBooking = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;

  const [status, rules, clinicHours, professionals] = await Promise.all([
    getOnlineBookingStatus(clinicId),
    loadBookingRules(clinicId),
    loadWeeklyHours(clinicId),
    loadBookingProfessionals(clinicId),
  ]);

  res.json({ enabled: status.enabled, rules, clinicHours, professionals });
};

// PATCH /clinic/settings/online-booking   body: { enabled: boolean } -> { enabled }
// The clinic's own switch. Each professional's hours are kept when it's off
export const setOnlineBookingEnabled = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { enabled } = req.body ?? {};

  if (typeof enabled !== "boolean") {
    return badRequest(res, "INVALID_ENABLED", "enabled debe ser true o false");
  }

  await db
    .insert(clinicOnlineBooking)
    .values({ organizationId: clinicId, enabled, updatedBy: req.user!.id })
    .onConflictDoUpdate({
      target: clinicOnlineBooking.organizationId,
      set: { enabled, updatedBy: req.user!.id, updatedAt: new Date() },
    });

  res.json({ enabled });
};

// PUT /clinic/settings/online-booking/rules -> { rules }
// body: { minNoticeMinutes, maxDaysAhead, slotStepMinutes, cancelEnabled,
//         cancelNoticeHours, policyText, notifyEmail }
// The booking and cancellation criteria, all at once. They apply from now on:
// appointments already booked keep their time, and can be cancelled online
// according to the criteria of the moment they try
export const updateBookingRules = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;

  const rules = parseBookingRules(req.body ?? {});
  if (typeof rules === "string") return badRequest(res, "INVALID_RULES", rules);

  // The switch isn't touched: a clinic can set its criteria before switching on
  await db
    .insert(clinicOnlineBooking)
    .values({ organizationId: clinicId, ...rules, updatedBy: req.user!.id })
    .onConflictDoUpdate({
      target: clinicOnlineBooking.organizationId,
      set: { ...rules, updatedBy: req.user!.id, updatedAt: new Date() },
    });

  res.json({ rules });
};

// PUT /clinic/settings/online-booking/professionals/:memberId/hours
// body: { weeklyHours: [{ weekday, startTime, endTime }] } -> 204
// Replaces that professional's whole week. A day with no slots is closed;
// an empty week means they can't be booked online
export const updateProfessionalBookingHours = async (
  req: Request<{ memberId: string }>,
  res: Response,
) => {
  const clinicId = req.clinicId!;
  const { memberId } = req.params;
  const { weeklyHours } = req.body ?? {};

  const hoursError = weeklyHoursError(weeklyHours);
  if (hoursError) return badRequest(res, "INVALID_HOURS", hoursError);
  const slots = weeklyHours as WeeklySlot[];

  // Only this clinic's professionals (receptionists don't attend appointments)
  const [professional] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.id, memberId),
        eq(member.organizationId, clinicId),
        inArray(member.role, PROFESSIONAL_ROLES),
      ),
    )
    .limit(1);

  if (!professional) {
    res.status(404).json({
      error: {
        code: "PROFESSIONAL_NOT_FOUND",
        message: "Ese profesional no atiende citas en tu clínica",
      },
    });
    return;
  }

  // Delete and insert together, so nobody ever sees a half-saved week
  await db.transaction(async (tx) => {
    await tx.delete(physioBookingHours).where(eq(physioBookingHours.memberId, memberId));
    if (slots.length > 0) {
      await tx.insert(physioBookingHours).values(
        slots.map((s) => ({
          organizationId: clinicId,
          memberId,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
    }
  });

  res.status(204).end();
};
