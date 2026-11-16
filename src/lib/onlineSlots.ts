import { and, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  room,
  roomBlock,
  roomOpeningHours,
  service,
} from "../db/schema.js";
import { openingRangesFrom } from "./appointments.js";
import { loadExceptions, loadTimezone, loadWeeklyHours } from "./clinicSchedule.js";
import { loadBookingProfessionals, type BookingRules } from "./onlineBooking.js";
import { toHHMM, type TimeRange } from "./schedule.js";
import { addDaysIso, isoWeekdayOf, utcToZoned, zonedToUtc } from "./timezone.js";

// Free slots for online booking. A slot is offered when, for the whole
// appointment, all of these hold (same rules as lib/appointments.ts, plus the
// professional's booking hours):
//   - the clinic is open and the professional accepts online bookings
//   - the professional has no other appointment (in any clinic)
//   - a room of the right type is open, not blocked and has space
//   - it starts far enough from now, and not too far ahead (the clinic's
//     criteria: BookingRules in lib/onlineBooking.ts)

// Services patients can book themselves: active and individual (no groups yet)
export async function loadBookableService(clinicId: string, serviceId: string) {
  const [svc] = await db
    .select()
    .from(service)
    .where(
      and(
        eq(service.id, serviceId),
        eq(service.organizationId, clinicId),
        eq(service.isActive, true),
        eq(service.isGroup, false),
      ),
    )
    .limit(1);
  return svc;
}

// The clinic's date today, and the last date that can be booked
export function bookingWindow(timeZone: string, rules: BookingRules, now = new Date()) {
  const today = utcToZoned(now, timeZone).date;
  return { today, lastDate: addDaysIso(today, rules.maxDaysAhead) };
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// The parts of the day inside both groups of ranges
function intersect(a: TimeRange[], b: TimeRange[]): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(toMinutes(x.startTime), toMinutes(y.startTime));
      const end = Math.min(toMinutes(x.endTime), toMinutes(y.endTime));
      if (start < end) result.push({ start, end });
    }
  }
  return result.sort((p, q) => p.start - q.start);
}

export type OnlineSlot = {
  time: string; // clinic local "HH:MM"
  startsAt: Date;
  endsAt: Date;
  // A room that is free for it, and how many people fit in it
  roomId: string;
  roomCapacity: number;
  // Who could attend it
  professionals: { memberId: string; userId: string; name: string }[];
};

type SlotsInput = {
  clinicId: string;
  serviceId: string;
  rules: BookingRules;
  from: string; // clinic local dates, both included
  to: string;
  // Only this professional. Leave out for anyone available
  memberId?: string;
  now?: Date;
};

// The free slots of each date in [from, to]. null if the service can't be
// booked online. Dates with no slots come back with an empty list
export async function loadOnlineSlots(input: SlotsInput) {
  const { clinicId, rules, from, to } = input;
  const now = input.now ?? new Date();

  const svc = await loadBookableService(clinicId, input.serviceId);
  if (!svc) return null;

  const [timeZone, weeklyHours, exceptions, allProfessionals, rooms] = await Promise.all([
    loadTimezone(clinicId),
    loadWeeklyHours(clinicId),
    loadExceptions(clinicId, { from, to }),
    loadBookingProfessionals(clinicId),
    db
      .select()
      .from(room)
      .where(
        and(
          eq(room.organizationId, clinicId),
          eq(room.isActive, true),
          svc.roomTypeId ? eq(room.roomTypeId, svc.roomTypeId) : undefined,
        ),
      ),
  ]);

  // Only those open to online bookings
  const professionals = allProfessionals.filter(
    (p) => p.weeklyHours.length > 0 && (!input.memberId || p.memberId === input.memberId),
  );
  // Small rooms first, so a single patient doesn't take the gym
  rooms.sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name));

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) dates.push(d);
  const days = new Map<string, OnlineSlot[]>(dates.map((d) => [d, []]));
  if (professionals.length === 0 || rooms.length === 0) return { service: svc, timeZone, days };

  const rangeStart = zonedToUtc(from, "00:00", timeZone);
  const rangeEnd = zonedToUtc(addDaysIso(to, 1), "00:00", timeZone);
  // Appointments just before the range can still hold a room (cleaning time)
  const busyFrom = new Date(rangeStart.getTime() - 24 * 3600_000);
  const roomIds = rooms.map((r) => r.id);
  const userIds = professionals.map((p) => p.userId);

  const [roomHours, blocks, busy] = await Promise.all([
    db.select().from(roomOpeningHours).where(inArray(roomOpeningHours.roomId, roomIds)),
    db
      .select()
      .from(roomBlock)
      .where(
        and(
          inArray(roomBlock.roomId, roomIds),
          lt(roomBlock.startsAt, rangeEnd),
          gt(roomBlock.endsAt, busyFrom),
        ),
      ),
    // What already takes these rooms, or these professionals in ANY clinic
    db
      .select({
        id: appointment.id,
        roomId: appointment.roomId,
        physioId: appointment.physioId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        bufferMinutes: service.bufferMinutes,
      })
      .from(appointment)
      .innerJoin(service, eq(appointment.serviceId, service.id))
      .where(
        and(
          ne(appointment.status, "cancelled"),
          lt(appointment.startsAt, rangeEnd),
          gt(appointment.endsAt, busyFrom),
          or(inArray(appointment.roomId, roomIds), inArray(appointment.physioId, userIds)),
        ),
      ),
  ]);

  // People in each of those appointments (for rooms with several places)
  const people = new Map<string, number>();
  if (busy.length > 0) {
    const rows = await db
      .select({ appointmentId: appointmentPatient.appointmentId })
      .from(appointmentPatient)
      .where(inArray(appointmentPatient.appointmentId, busy.map((b) => b.id)));
    for (const { appointmentId } of rows) {
      people.set(appointmentId, (people.get(appointmentId) ?? 0) + 1);
    }
  }

  const earliest = new Date(now.getTime() + rules.minNoticeMinutes * 60000);
  const durationMs = svc.durationMinutes * 60000;
  const bufferMs = svc.bufferMinutes * 60000;

  // A room free from `startsAt` until the appointment and its cleaning time end
  const freeRoom = (weekday: number, start: number, startsAt: Date) => {
    const busyUntil = new Date(startsAt.getTime() + durationMs + bufferMs);
    return rooms.find((rm) => {
      // Own hours, if it has them: the appointment must fit in one range
      const own = roomHours.filter((h) => h.roomId === rm.id);
      if (
        own.length > 0 &&
        !own.some(
          (h) =>
            h.weekday === weekday &&
            toMinutes(toHHMM(h.startTime)) <= start &&
            start + svc.durationMinutes <= toMinutes(toHHMM(h.endTime)),
        )
      ) {
        return false;
      }
      if (blocks.some((b) => b.roomId === rm.id && b.startsAt < busyUntil && b.endsAt > startsAt)) {
        return false;
      }
      const inRoom = busy
        .filter(
          (a) =>
            a.roomId === rm.id &&
            a.startsAt < busyUntil &&
            a.endsAt.getTime() + a.bufferMinutes * 60000 > startsAt.getTime(),
        )
        .reduce((sum, a) => sum + (people.get(a.id) ?? 0), 0);
      return inRoom + 1 <= rm.capacity;
    });
  };

  for (const date of dates) {
    const weekday = isoWeekdayOf(date);
    const clinicRanges = openingRangesFrom(weeklyHours, exceptions, date);
    if (clinicRanges.length === 0) continue;

    const byTime = new Map<string, OnlineSlot>();
    // The same room answer serves every professional at that time
    const roomAt = new Map<string, (typeof rooms)[number] | null>();

    for (const professional of professionals) {
      const open = intersect(
        clinicRanges,
        professional.weeklyHours.filter((h) => h.weekday === weekday),
      );
      for (const range of open) {
        for (
          let start = range.start;
          start + svc.durationMinutes <= range.end;
          start += rules.slotStepMinutes
        ) {
          const time = toTime(start);
          const startsAt = zonedToUtc(date, time, timeZone);
          if (startsAt < earliest) continue;
          const endsAt = new Date(startsAt.getTime() + durationMs);

          const physioBusy = busy.some(
            (a) => a.physioId === professional.userId && a.startsAt < endsAt && a.endsAt > startsAt,
          );
          if (physioBusy) continue;

          if (!roomAt.has(time)) roomAt.set(time, freeRoom(weekday, start, startsAt) ?? null);
          const rm = roomAt.get(time);
          if (!rm) continue;

          const slot = byTime.get(time) ?? {
            time,
            startsAt,
            endsAt,
            roomId: rm.id,
            roomCapacity: rm.capacity,
            professionals: [],
          };
          slot.professionals.push({
            memberId: professional.memberId,
            userId: professional.userId,
            name: professional.name,
          });
          byTime.set(time, slot);
        }
      }
    }

    days.set(
      date,
      [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time)),
    );
  }

  return { service: svc, timeZone, days };
}
