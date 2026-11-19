import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  appointment,
  appointmentPatient,
  member,
  room,
  roomBlock,
  roomOpeningHours,
  service,
} from "../db/schema.js";
import { loadExceptions, loadWeeklyHours } from "./clinicSchedule.js";
import { toHHMM, type TimeRange } from "./schedule.js";
import { isoWeekdayOf } from "./timezone.js";

// The rules an appointment must follow (CALENDARIO.md, "Reglas de conflicto").
// Used when creating and editing. Each failed rule returns a clear message.

// Who can attend appointments
export const PROFESSIONAL_ROLES = ["owner", "admin", "physio"];

export type RuleError = { status: 400 | 409; code: string; message: string };

const fail = (status: 400 | 409, code: string, message: string): RuleError => ({
  status,
  code,
  message,
});

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
};

// Fully inside one of the ranges?
const fitsIn = (start: number, end: number, ranges: TimeRange[]) =>
  ranges.some((r) => toMinutes(r.startTime) <= start && end <= toMinutes(r.endTime));

type WeeklyHours = Awaited<ReturnType<typeof loadWeeklyHours>>;
type Exceptions = Awaited<ReturnType<typeof loadExceptions>>;

// When the clinic is open on a date, from already loaded hours and exceptions:
// an exception covering the date wins, otherwise that weekday's hours.
// Same rule as the calendar (calendarUtils.ts → openingFor)
export function openingRangesFrom(
  weeklyHours: WeeklyHours,
  exceptions: Exceptions,
  date: string,
): TimeRange[] {
  const weekday = isoWeekdayOf(date);
  const exception = exceptions.find((e) => e.startDate <= date && date <= e.endDate);
  if (exception) {
    return exception.type === "closed"
      ? []
      : exception.hours.filter((h) => h.weekday === null || h.weekday === weekday);
  }
  return weeklyHours.filter((h) => h.weekday === weekday);
}

// The same, loading what it needs for one date
export async function clinicOpeningOn(clinicId: string, date: string) {
  const [weeklyHours, exceptions] = await Promise.all([
    loadWeeklyHours(clinicId),
    loadExceptions(clinicId, { from: date, to: date }),
  ]);
  return openingRangesFrom(weeklyHours, exceptions, date);
}

// Service, room and physio of the clinic, checked and loaded
export async function loadParts(
  clinicId: string,
  ids: { serviceId: string; roomId: string; physioId: string | null },
) {
  // Not an id at all (a typo, an old link): it doesn't exist, rather than a
  // database error
  const isId = (v: unknown) =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const none = Promise.resolve([] as never[]);
  const [[svc], [rm], [professional]] = await Promise.all([
    !isId(ids.serviceId) ? none : db
      .select()
      .from(service)
      .where(and(eq(service.id, ids.serviceId), eq(service.organizationId, clinicId)))
      .limit(1),
    !isId(ids.roomId) ? none : db
      .select()
      .from(room)
      .where(and(eq(room.id, ids.roomId), eq(room.organizationId, clinicId)))
      .limit(1),
    ids.physioId
      ? db
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.organizationId, clinicId),
              eq(member.userId, ids.physioId),
              inArray(member.role, PROFESSIONAL_ROLES),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);
  return { svc, rm, professional };
}

type CheckInput = {
  clinicId: string;
  serviceId: string;
  roomId: string;
  // null: a class session without a physio yet (only group services, and only
  // when the caller allows it)
  physioId: string | null;
  date: string; // clinic local date
  startTime: string; // clinic local "HH:MM"
  startsAt: Date; // the same moment, in UTC
  patientCount: number;
  // When editing: the appointment itself doesn't count as a conflict
  excludeAppointmentId?: string;
  // Class sessions (R3): may have no physio yet
  classSession?: boolean;
};

// null if everything is fine, or the first rule that fails
export async function checkAppointmentRules(input: CheckInput): Promise<RuleError | null> {
  const { svc, rm, professional } = await loadParts(input.clinicId, input);

  // 1. Service, room and physio exist in this clinic and can be used
  if (!svc) return fail(400, "INVALID_SERVICE", "Ese servicio no existe en tu clínica");
  if (!svc.isActive) return fail(400, "SERVICE_INACTIVE", "Ese servicio está desactivado");
  if (!rm) return fail(400, "INVALID_ROOM", "Esa sala no existe en tu clínica");
  if (!rm.isActive) return fail(400, "ROOM_INACTIVE", "Esa sala está desactivada");
  if (input.physioId === null) {
    if (!input.classSession || !svc.isGroup) {
      return fail(400, "PHYSIO_REQUIRED", "Elige el fisio que atenderá la cita");
    }
  } else if (!professional) {
    return fail(400, "INVALID_PHYSIO", "Ese profesional no puede atender citas en tu clínica");
  }

  // 2. The service may require a type of room
  if (svc.roomTypeId && svc.roomTypeId !== rm.roomTypeId) {
    return fail(400, "WRONG_ROOM_TYPE", "Este servicio no se puede hacer en esa sala (tipo de sala distinto)");
  }

  // 3. Patients: at least one, at most what the service and the room allow
  const maxPatients = Math.min(svc.maxPatients, rm.capacity);
  // Group sessions may start empty (people join or book later); individual
  // appointments need their patient
  if (input.patientCount < 1 && !svc.isGroup) {
    return fail(400, "NO_PATIENTS", "Añade al menos un paciente");
  }
  if (input.patientCount > maxPatients) {
    return fail(
      400,
      "TOO_MANY_PATIENTS",
      `Como máximo ${maxPatients} ${maxPatients === 1 ? "paciente" : "pacientes"} (servicio y sala)`,
    );
  }

  // 4. Inside the clinic's opening hours (and the room's own hours, if it has them)
  const start = toMinutes(input.startTime);
  const end = start + svc.durationMinutes;
  const clinicRanges = await clinicOpeningOn(input.clinicId, input.date);
  if (!fitsIn(start, end, clinicRanges)) {
    return fail(
      409,
      "CLINIC_CLOSED",
      clinicRanges.length === 0
        ? "La clínica está cerrada ese día"
        : "La cita queda fuera del horario de la clínica",
    );
  }
  const roomHours = await db
    .select()
    .from(roomOpeningHours)
    .where(
      and(
        eq(roomOpeningHours.roomId, rm.id),
        eq(roomOpeningHours.weekday, isoWeekdayOf(input.date)),
      ),
    );
  const roomHasOwnHours = (
    await db
      .select({ id: roomOpeningHours.id })
      .from(roomOpeningHours)
      .where(eq(roomOpeningHours.roomId, rm.id))
      .limit(1)
  ).length > 0;
  if (
    roomHasOwnHours &&
    !fitsIn(
      start,
      end,
      roomHours.map((h) => ({ startTime: toHHMM(h.startTime), endTime: toHHMM(h.endTime) })),
    )
  ) {
    return fail(409, "ROOM_CLOSED", "La sala no está disponible a esa hora (horario propio)");
  }

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60000);
  // The room stays busy for the cleaning time after the appointment
  const roomBusyUntil = new Date(endsAt.getTime() + svc.bufferMinutes * 60000);

  // 5. The room isn't blocked (maintenance…)
  const [block] = await db
    .select({ id: roomBlock.id })
    .from(roomBlock)
    .where(and(eq(roomBlock.roomId, rm.id), lt(roomBlock.startsAt, roomBusyUntil), gt(roomBlock.endsAt, startsAt)))
    .limit(1);
  if (block) return fail(409, "ROOM_BLOCKED", "La sala está bloqueada a esa hora");

  // 6. The room has space: people already there (with their cleaning time) + these
  const others = await db
    .select({
      id: appointment.id,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      bufferMinutes: service.bufferMinutes,
    })
    .from(appointment)
    .innerJoin(service, eq(appointment.serviceId, service.id))
    .where(
      and(
        eq(appointment.roomId, rm.id),
        ne(appointment.status, "cancelled"),
        lt(appointment.startsAt, roomBusyUntil),
        input.excludeAppointmentId ? ne(appointment.id, input.excludeAppointmentId) : undefined,
      ),
    );
  const overlapping = others.filter(
    (o) => o.endsAt.getTime() + o.bufferMinutes * 60000 > startsAt.getTime(),
  );
  if (overlapping.length > 0) {
    const counts = await db
      .select({ appointmentId: appointmentPatient.appointmentId })
      .from(appointmentPatient)
      .where(inArray(appointmentPatient.appointmentId, overlapping.map((o) => o.id)));
    const peopleInRoom = counts.length;
    if (peopleInRoom + input.patientCount > rm.capacity) {
      return fail(
        409,
        "ROOM_FULL",
        rm.capacity === 1
          ? "La sala ya está ocupada a esa hora"
          : `La sala está llena a esa hora (${peopleInRoom} de ${rm.capacity} plazas ocupadas)`,
      );
    }
  }

  // 7. The physio has no other appointment at that time, in any clinic
  //    (the database also guarantees it: appointment_physio_no_overlap)
  if (input.physioId === null) return null;
  const [physioBusy] = await db
    .select({ id: appointment.id })
    .from(appointment)
    .where(
      and(
        eq(appointment.physioId, input.physioId),
        ne(appointment.status, "cancelled"),
        lt(appointment.startsAt, endsAt),
        gt(appointment.endsAt, startsAt),
        input.excludeAppointmentId ? ne(appointment.id, input.excludeAppointmentId) : undefined,
      ),
    )
    .limit(1);
  if (physioBusy) return fail(409, "PHYSIO_BUSY", "El fisio ya tiene una cita a esa hora");

  return null;
}

// Postgres error raised by appointment_physio_no_overlap (two requests at once)
export const isPhysioOverlapError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  ((error as { code?: string }).code === "23P01" ||
    (error as { cause?: { code?: string } }).cause?.code === "23P01");

// ---------- Problems of existing appointments ----------

export type AppointmentIssue = { code: string; message: string };

// What an existing appointment needs to know about the clinic today
export type IssueInput = {
  date: string; // local
  startTime: string; // local "HH:MM"
  durationMinutes: number;
  startsAt: Date;
  endsAt: Date;
  patientCount: number;
  roomId: string;
  roomIsActive: boolean;
  roomCapacity: number;
  roomTypeId: string | null;
  serviceIsActive: boolean;
  serviceRoomTypeId: string | null;
  serviceMaxPatients: number;
  physioId: string | null;
};

// Why an appointment no longer fits after the clinic changed something
// (hours, holidays, rooms, services, team). Nothing is changed automatically:
// the calendar shows a warning so someone can reschedule or cancel it.
// `others`: the clinic's other active appointments around it (for room capacity)
export function appointmentIssues(
  a: IssueInput,
  context: {
    weeklyHours: WeeklyHours;
    exceptions: Exceptions;
    professionalIds: Set<string>;
    others: { roomId: string; startsAt: Date; endsAt: Date; patientCount: number }[];
  },
): AppointmentIssue[] {
  const issues: AppointmentIssue[] = [];

  const ranges = openingRangesFrom(context.weeklyHours, context.exceptions, a.date);
  const start = toMinutes(a.startTime);
  if (ranges.length === 0) {
    issues.push({ code: "CLINIC_CLOSED", message: "La clínica está cerrada ese día" });
  } else if (!fitsIn(start, start + a.durationMinutes, ranges)) {
    issues.push({ code: "OUTSIDE_HOURS", message: "Queda fuera del horario de la clínica" });
  }

  if (!a.roomIsActive) {
    issues.push({ code: "ROOM_INACTIVE", message: "La sala está desactivada" });
  }
  if (!a.serviceIsActive) {
    issues.push({ code: "SERVICE_INACTIVE", message: "El servicio está desactivado" });
  }
  if (a.serviceRoomTypeId && a.serviceRoomTypeId !== a.roomTypeId) {
    issues.push({
      code: "WRONG_ROOM_TYPE",
      message: "La sala ya no es del tipo que necesita el servicio",
    });
  }
  if (a.patientCount > a.serviceMaxPatients) {
    issues.push({
      code: "TOO_MANY_PATIENTS",
      message: `Tiene más pacientes de los que admite el servicio (máximo ${a.serviceMaxPatients})`,
    });
  }

  // People in the room at the same time, this appointment included
  const peopleInRoom =
    a.patientCount +
    context.others
      .filter((o) => o.roomId === a.roomId && o.startsAt < a.endsAt && o.endsAt > a.startsAt)
      .reduce((sum, o) => sum + o.patientCount, 0);
  if (peopleInRoom > a.roomCapacity) {
    issues.push({
      code: "ROOM_OVER_CAPACITY",
      message: `La sala tiene más personas de las que caben (${peopleInRoom} de ${a.roomCapacity})`,
    });
  }

  if (a.physioId === null) {
    issues.push({ code: "NO_PHYSIO", message: "Todavía no tiene fisio asignado" });
  } else if (!context.professionalIds.has(a.physioId)) {
    issues.push({ code: "PHYSIO_NOT_IN_TEAM", message: "El fisio ya no forma parte del equipo" });
  }

  return issues;
}
