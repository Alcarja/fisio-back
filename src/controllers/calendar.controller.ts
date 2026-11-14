import type { Request, Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { member, room, roomType, service, user } from "../db/schema.js";
import { loadExceptions, loadTimezone, loadWeeklyHours } from "../lib/clinicSchedule.js";
import { isIsoDate } from "../lib/schedule.js";

// Roles that can attend appointments (appear as "fisio" in the calendar).
// Owners and admins often treat patients too; receptionists don't
const PROFESSIONAL_ROLES = ["owner", "admin", "physio"];

// GET /clinic/calendar/config?from=YYYY-MM-DD&to=YYYY-MM-DD
// Everything the calendar needs from the clinic's settings, for every clinic
// role (Configuración is only for owners and admins, so this is separate):
// - timezone, weekly hours, and the exceptions touching [from, to]
// - active rooms and active services (what can be booked)
// - professionals who can attend appointments
export const getCalendarConfig = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { from, to } = req.query;

  if ((from !== undefined && !isIsoDate(from)) || (to !== undefined && !isIsoDate(to))) {
    res.status(400).json({
      error: { code: "INVALID_RANGE", message: "from y to deben tener el formato AAAA-MM-DD" },
    });
    return;
  }

  const [timezone, weeklyHours, exceptions, rooms, services, professionals] = await Promise.all([
    loadTimezone(clinicId),
    loadWeeklyHours(clinicId),
    loadExceptions(clinicId, { from: from as string | undefined, to: to as string | undefined }),

    db
      .select({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        roomTypeId: room.roomTypeId,
        roomTypeName: roomType.name,
      })
      .from(room)
      .leftJoin(roomType, eq(room.roomTypeId, roomType.id))
      .where(and(eq(room.organizationId, clinicId), eq(room.isActive, true)))
      .orderBy(asc(room.name)),

    db
      .select({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        roomTypeId: service.roomTypeId,
        isGroup: service.isGroup,
        maxPatients: service.maxPatients,
        color: service.color,
      })
      .from(service)
      .where(and(eq(service.organizationId, clinicId), eq(service.isActive, true)))
      .orderBy(asc(service.name)),

    db
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        role: member.role,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(
        and(eq(member.organizationId, clinicId), inArray(member.role, PROFESSIONAL_ROLES)),
      )
      .orderBy(asc(user.name)),
  ]);

  res.json({ timezone, weeklyHours, exceptions, rooms, services, professionals });
};
