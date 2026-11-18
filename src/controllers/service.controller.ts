import type { Request, Response } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointment, roomType, service } from "../db/schema.js";

// Configuración → Servicios of the active clinic (owners and admins).
// The clinic is always req.clinicId, set by requireActiveClinic from the session.

// Limits (the database only requires > 0 / >= 0; these keep values sensible)
const MAX_DURATION = 480; // 8 h
const MAX_BUFFER = 120;
const MAX_PRICE_CENTS = 1_000_000; // 10.000 €
const MAX_GROUP_PATIENTS = 100;
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MAX_PUBLIC_DESCRIPTION = 1000;

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

const conflict = (res: Response, code: string, message: string) =>
  res.status(409).json({ error: { code, message } });

const notFound = (res: Response) =>
  res.status(404).json({
    error: { code: "SERVICE_NOT_FOUND", message: "Este servicio no existe en tu clínica" },
  });

const isIntBetween = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

// Service fields sent to the frontend (with its room type's name)
const serviceColumns = {
  id: service.id,
  name: service.name,
  durationMinutes: service.durationMinutes,
  bufferMinutes: service.bufferMinutes,
  priceCents: service.priceCents,
  roomTypeId: service.roomTypeId,
  roomTypeName: roomType.name,
  isGroup: service.isGroup,
  maxPatients: service.maxPatients,
  color: service.color,
  isActive: service.isActive,
  // On the clinic's website (Mi web)
  publicDescription: service.publicDescription,
  showOnWeb: service.showOnWeb,
};

async function loadServices(clinicId: string, serviceId?: string) {
  return db
    .select(serviceColumns)
    .from(service)
    .leftJoin(roomType, eq(service.roomTypeId, roomType.id))
    .where(
      serviceId
        ? and(eq(service.organizationId, clinicId), eq(service.id, serviceId))
        : eq(service.organizationId, clinicId),
    )
    .orderBy(asc(service.name));
}

async function roomTypeBelongs(clinicId: string, roomTypeId: string | null) {
  if (roomTypeId === null) return true;
  const [found] = await db
    .select({ id: roomType.id })
    .from(roomType)
    .where(and(eq(roomType.id, roomTypeId), eq(roomType.organizationId, clinicId)))
    .limit(1);
  return !!found;
}

async function nameTaken(clinicId: string, name: string, exceptId?: string) {
  const [found] = await db
    .select({ id: service.id })
    .from(service)
    .where(
      and(
        eq(service.organizationId, clinicId),
        eq(service.name, name),
        exceptId ? ne(service.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return !!found;
}

type ServiceData = {
  name?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  priceCents?: number;
  roomTypeId?: string | null;
  isGroup?: boolean;
  maxPatients?: number;
  color?: string;
  isActive?: boolean;
  publicDescription?: string | null;
  showOnWeb?: boolean;
};

// Validates the fields sent. `partial`: missing fields are fine (PATCH).
// `current` is the saved service, to check isGroup + maxPatients together
function parseServiceInput(
  body: Record<string, unknown>,
  partial: boolean,
  current?: { isGroup: boolean; maxPatients: number },
): { data?: ServiceData; error?: string } {
  const b = body ?? {};
  const data: ServiceData = {};
  const sent = (key: string) => b[key] !== undefined;

  if (sent("name") || !partial) {
    if (typeof b.name !== "string" || !b.name.trim()) return { error: "El nombre es obligatorio" };
    data.name = b.name.trim();
  }
  if (sent("durationMinutes") || !partial) {
    if (!isIntBetween(b.durationMinutes, 1, MAX_DURATION)) {
      return { error: `La duración debe estar entre 1 y ${MAX_DURATION} minutos` };
    }
    data.durationMinutes = b.durationMinutes;
  }
  if (sent("bufferMinutes")) {
    if (!isIntBetween(b.bufferMinutes, 0, MAX_BUFFER)) {
      return { error: `El tiempo de limpieza debe estar entre 0 y ${MAX_BUFFER} minutos` };
    }
    data.bufferMinutes = b.bufferMinutes;
  }
  if (sent("priceCents")) {
    if (!isIntBetween(b.priceCents, 0, MAX_PRICE_CENTS)) {
      return { error: "El precio no es válido" };
    }
    data.priceCents = b.priceCents;
  }
  if (sent("roomTypeId")) {
    if (b.roomTypeId !== null && typeof b.roomTypeId !== "string") {
      return { error: "El tipo de sala no es válido" };
    }
    data.roomTypeId = b.roomTypeId as string | null;
  }
  if (sent("color")) {
    if (typeof b.color !== "string" || !COLOR_PATTERN.test(b.color)) {
      return { error: "El color debe tener el formato #RRGGBB" };
    }
    data.color = b.color;
  }
  if (sent("isActive")) {
    if (typeof b.isActive !== "boolean") return { error: "isActive debe ser true o false" };
    data.isActive = b.isActive;
  }
  // Website: plain text (never HTML), shown under the service on Mi web
  if (sent("publicDescription")) {
    if (b.publicDescription !== null && typeof b.publicDescription !== "string") {
      return { error: "La descripción para la web no es válida" };
    }
    const description = (b.publicDescription as string | null)?.trim() || null;
    if (description && description.length > MAX_PUBLIC_DESCRIPTION) {
      return { error: `La descripción para la web admite ${MAX_PUBLIC_DESCRIPTION} caracteres` };
    }
    data.publicDescription = description;
  }
  if (sent("showOnWeb")) {
    if (typeof b.showOnWeb !== "boolean") return { error: "showOnWeb debe ser true o false" };
    data.showOnWeb = b.showOnWeb;
  }

  // Individual or group: checked together with what's already saved
  if (sent("isGroup") || sent("maxPatients")) {
    if (sent("isGroup") && typeof b.isGroup !== "boolean") {
      return { error: "isGroup debe ser true o false" };
    }
    const isGroup = sent("isGroup") ? (b.isGroup as boolean) : (current?.isGroup ?? false);
    if (isGroup) {
      const maxPatients = sent("maxPatients") ? b.maxPatients : current?.maxPatients;
      if (!isIntBetween(maxPatients, 2, MAX_GROUP_PATIENTS)) {
        return {
          error: `Un servicio en grupo necesita entre 2 y ${MAX_GROUP_PATIENTS} pacientes como máximo`,
        };
      }
      data.isGroup = true;
      data.maxPatients = maxPatients;
    } else {
      // Individual always means one patient
      data.isGroup = false;
      data.maxPatients = 1;
    }
  }
  return { data };
}

// GET /clinic/settings/services -> { services }
export const getServices = async (req: Request, res: Response) => {
  res.json({ services: await loadServices(req.clinicId!) });
};

// POST /clinic/settings/services -> 201 { service }
// body: { name, durationMinutes, bufferMinutes?, priceCents?, roomTypeId?, isGroup?, maxPatients?, color? }
export const createService = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const parsed = parseServiceInput(req.body, false);
  if (parsed.error) return badRequest(res, "INVALID_SERVICE", parsed.error);
  const data = parsed.data!;

  if (!(await roomTypeBelongs(clinicId, data.roomTypeId ?? null))) {
    return badRequest(res, "INVALID_ROOM_TYPE", "Ese tipo de sala no existe en tu clínica");
  }
  if (await nameTaken(clinicId, data.name!)) {
    return conflict(res, "SERVICE_NAME_TAKEN", "Ya hay un servicio con ese nombre");
  }

  const [created] = await db
    .insert(service)
    .values({ organizationId: clinicId, name: data.name!, durationMinutes: data.durationMinutes!, ...data })
    .returning({ id: service.id });

  const [createdService] = await loadServices(clinicId, created!.id);
  res.status(201).json({ service: createdService });
};

// PATCH /clinic/settings/services/:serviceId -> { service }. Send only what changes
export const updateService = async (req: Request<{ serviceId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { serviceId } = req.params;

  const [current] = await db
    .select({ isGroup: service.isGroup, maxPatients: service.maxPatients })
    .from(service)
    .where(and(eq(service.id, serviceId), eq(service.organizationId, clinicId)))
    .limit(1);
  if (!current) return notFound(res);

  const parsed = parseServiceInput(req.body, true, current);
  if (parsed.error) return badRequest(res, "INVALID_SERVICE", parsed.error);
  const data = parsed.data!;

  if (Object.keys(data).length === 0) {
    return badRequest(res, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }
  if (data.roomTypeId !== undefined && !(await roomTypeBelongs(clinicId, data.roomTypeId))) {
    return badRequest(res, "INVALID_ROOM_TYPE", "Ese tipo de sala no existe en tu clínica");
  }
  if (data.name && (await nameTaken(clinicId, data.name, serviceId))) {
    return conflict(res, "SERVICE_NAME_TAKEN", "Ya hay un servicio con ese nombre");
  }

  await db.update(service).set(data).where(eq(service.id, serviceId));

  const [updated] = await loadServices(clinicId, serviceId);
  res.json({ service: updated });
};

// DELETE /clinic/settings/services/:serviceId -> 204
// A service with appointments can't be deleted (it keeps their history): deactivate it
export const deleteService = async (req: Request<{ serviceId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { serviceId } = req.params;

  const [target] = await db
    .select({ id: service.id })
    .from(service)
    .where(and(eq(service.id, serviceId), eq(service.organizationId, clinicId)))
    .limit(1);
  if (!target) return notFound(res);

  const [used] = await db
    .select({ id: appointment.id })
    .from(appointment)
    .where(eq(appointment.serviceId, serviceId))
    .limit(1);
  if (used) {
    return conflict(
      res,
      "SERVICE_HAS_APPOINTMENTS",
      "Este servicio tiene citas, así que no se puede eliminar. Desactívalo para que no se use más.",
    );
  }

  await db.delete(service).where(eq(service.id, serviceId));
  res.status(204).end();
};
