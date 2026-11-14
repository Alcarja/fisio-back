import type { Request, Response } from "express";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointment, room, roomType } from "../db/schema.js";

// Configuración → Salas of the active clinic (owners and admins).
// The clinic is always req.clinicId, set by requireActiveClinic from the session.

const MAX_CAPACITY = 100;

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

const conflict = (res: Response, code: string, message: string) =>
  res.status(409).json({ error: { code, message } });

const notFound = (res: Response, code: string, message: string) =>
  res.status(404).json({ error: { code, message } });

// Room fields sent to the frontend (with its type's name)
const roomColumns = {
  id: room.id,
  name: room.name,
  capacity: room.capacity,
  roomTypeId: room.roomTypeId,
  roomTypeName: roomType.name,
  description: room.description,
  isActive: room.isActive,
};

async function loadRooms(clinicId: string, roomId?: string) {
  return db
    .select(roomColumns)
    .from(room)
    .leftJoin(roomType, eq(room.roomTypeId, roomType.id))
    .where(roomId ? and(eq(room.organizationId, clinicId), eq(room.id, roomId)) : eq(room.organizationId, clinicId))
    .orderBy(asc(room.name));
}

async function loadRoomTypes(clinicId: string) {
  const types = await db
    .select({ id: roomType.id, name: roomType.name })
    .from(roomType)
    .where(eq(roomType.organizationId, clinicId))
    .orderBy(asc(roomType.name));

  // How many rooms use each type (shown next to it)
  const counts = await db
    .select({ roomTypeId: room.roomTypeId, rooms: count() })
    .from(room)
    .where(eq(room.organizationId, clinicId))
    .groupBy(room.roomTypeId);

  return types.map((t) => ({
    ...t,
    roomCount: counts.find((c) => c.roomTypeId === t.id)?.rooms ?? 0,
  }));
}

// A room type id is valid only if it belongs to this clinic (or is null)
async function roomTypeBelongs(clinicId: string, roomTypeId: string | null) {
  if (roomTypeId === null) return true;
  const [found] = await db
    .select({ id: roomType.id })
    .from(roomType)
    .where(and(eq(roomType.id, roomTypeId), eq(roomType.organizationId, clinicId)))
    .limit(1);
  return !!found;
}

async function roomNameTaken(clinicId: string, name: string, exceptRoomId?: string) {
  const [found] = await db
    .select({ id: room.id })
    .from(room)
    .where(
      and(
        eq(room.organizationId, clinicId),
        eq(room.name, name),
        exceptRoomId ? ne(room.id, exceptRoomId) : undefined,
      ),
    )
    .limit(1);
  return !!found;
}

async function typeNameTaken(clinicId: string, name: string, exceptTypeId?: string) {
  const [found] = await db
    .select({ id: roomType.id })
    .from(roomType)
    .where(
      and(
        eq(roomType.organizationId, clinicId),
        eq(roomType.name, name),
        exceptTypeId ? ne(roomType.id, exceptTypeId) : undefined,
      ),
    )
    .limit(1);
  return !!found;
}

// Validates the room fields that were sent. `partial`: missing fields are fine (PATCH)
function parseRoomInput(body: Record<string, unknown>, partial: boolean) {
  const { name, capacity, roomTypeId, description, isActive } = body ?? {};
  const data: {
    name?: string;
    capacity?: number;
    roomTypeId?: string | null;
    description?: string | null;
    isActive?: boolean;
  } = {};

  if (name !== undefined || !partial) {
    if (typeof name !== "string" || !name.trim()) return { error: "El nombre es obligatorio" };
    data.name = name.trim();
  }
  if (capacity !== undefined || !partial) {
    if (!Number.isInteger(capacity) || (capacity as number) < 1 || (capacity as number) > MAX_CAPACITY) {
      return { error: `La capacidad debe ser un número entre 1 y ${MAX_CAPACITY}` };
    }
    data.capacity = capacity as number;
  }
  if (roomTypeId !== undefined) {
    if (roomTypeId !== null && typeof roomTypeId !== "string") {
      return { error: "El tipo de sala no es válido" };
    }
    data.roomTypeId = roomTypeId;
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return { error: "La descripción debe ser un texto" };
    }
    data.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") return { error: "isActive debe ser true o false" };
    data.isActive = isActive;
  }
  return { data };
}

// ---------- Rooms and types together ----------

// GET /clinic/settings/rooms -> { rooms, roomTypes }
export const getRooms = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const [rooms, roomTypes] = await Promise.all([loadRooms(clinicId), loadRoomTypes(clinicId)]);
  res.json({ rooms, roomTypes });
};

// ---------- Rooms ----------

// POST /clinic/settings/rooms   body: { name, capacity, roomTypeId?, description? } -> 201 { room }
export const createRoom = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const parsed = parseRoomInput(req.body, false);
  if (parsed.error) return badRequest(res, "INVALID_ROOM", parsed.error);
  const data = parsed.data!;

  if (!(await roomTypeBelongs(clinicId, data.roomTypeId ?? null))) {
    return badRequest(res, "INVALID_ROOM_TYPE", "Ese tipo de sala no existe en tu clínica");
  }
  if (await roomNameTaken(clinicId, data.name!)) {
    return conflict(res, "ROOM_NAME_TAKEN", "Ya hay una sala con ese nombre");
  }

  const [created] = await db
    .insert(room)
    .values({
      organizationId: clinicId,
      name: data.name!,
      capacity: data.capacity!,
      roomTypeId: data.roomTypeId ?? null,
      description: data.description ?? null,
    })
    .returning({ id: room.id });

  const [createdRoom] = await loadRooms(clinicId, created!.id);
  res.status(201).json({ room: createdRoom });
};

// PATCH /clinic/settings/rooms/:roomId   body: any of { name, capacity, roomTypeId, description, isActive }
export const updateRoom = async (req: Request<{ roomId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { roomId } = req.params;
  const parsed = parseRoomInput(req.body, true);
  if (parsed.error) return badRequest(res, "INVALID_ROOM", parsed.error);
  const data = parsed.data!;

  if (Object.keys(data).length === 0) {
    return badRequest(res, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }
  if (data.roomTypeId !== undefined && !(await roomTypeBelongs(clinicId, data.roomTypeId))) {
    return badRequest(res, "INVALID_ROOM_TYPE", "Ese tipo de sala no existe en tu clínica");
  }
  if (data.name && (await roomNameTaken(clinicId, data.name, roomId))) {
    return conflict(res, "ROOM_NAME_TAKEN", "Ya hay una sala con ese nombre");
  }

  const updated = await db
    .update(room)
    .set(data)
    .where(and(eq(room.id, roomId), eq(room.organizationId, clinicId)))
    .returning({ id: room.id });

  if (updated.length === 0) {
    return notFound(res, "ROOM_NOT_FOUND", "Esta sala no existe en tu clínica");
  }

  const [updatedRoom] = await loadRooms(clinicId, roomId);
  res.json({ room: updatedRoom });
};

// DELETE /clinic/settings/rooms/:roomId -> 204
// A room with appointments can't be deleted (it keeps their history): deactivate it
export const deleteRoom = async (req: Request<{ roomId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { roomId } = req.params;

  const [target] = await db
    .select({ id: room.id })
    .from(room)
    .where(and(eq(room.id, roomId), eq(room.organizationId, clinicId)))
    .limit(1);
  if (!target) return notFound(res, "ROOM_NOT_FOUND", "Esta sala no existe en tu clínica");

  const [used] = await db
    .select({ id: appointment.id })
    .from(appointment)
    .where(eq(appointment.roomId, roomId))
    .limit(1);
  if (used) {
    return conflict(
      res,
      "ROOM_HAS_APPOINTMENTS",
      "Esta sala tiene citas, así que no se puede eliminar. Desactívala para que no se use más.",
    );
  }

  // Its own hours and blocks are deleted with it (onDelete: cascade)
  await db.delete(room).where(eq(room.id, roomId));
  res.status(204).end();
};

// ---------- Room types ----------

// POST /clinic/settings/rooms/types   body: { name } -> 201 { roomType }
export const createRoomType = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "INVALID_NAME", "El nombre es obligatorio");
  }
  if (await typeNameTaken(clinicId, name.trim())) {
    return conflict(res, "ROOM_TYPE_NAME_TAKEN", "Ya hay un tipo de sala con ese nombre");
  }

  const [created] = await db
    .insert(roomType)
    .values({ organizationId: clinicId, name: name.trim() })
    .returning({ id: roomType.id, name: roomType.name });

  res.status(201).json({ roomType: { ...created, roomCount: 0 } });
};

// PATCH /clinic/settings/rooms/types/:roomTypeId   body: { name }
export const updateRoomType = async (req: Request<{ roomTypeId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { roomTypeId } = req.params;
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return badRequest(res, "INVALID_NAME", "El nombre es obligatorio");
  }
  if (await typeNameTaken(clinicId, name.trim(), roomTypeId)) {
    return conflict(res, "ROOM_TYPE_NAME_TAKEN", "Ya hay un tipo de sala con ese nombre");
  }

  const updated = await db
    .update(roomType)
    .set({ name: name.trim() })
    .where(and(eq(roomType.id, roomTypeId), eq(roomType.organizationId, clinicId)))
    .returning({ id: roomType.id, name: roomType.name });

  if (updated.length === 0) {
    return notFound(res, "ROOM_TYPE_NOT_FOUND", "Este tipo de sala no existe en tu clínica");
  }
  res.json({ roomType: updated[0] });
};

// DELETE /clinic/settings/rooms/types/:roomTypeId -> 204
// Rooms and services that used it are left without a type (onDelete: set null)
export const deleteRoomType = async (req: Request<{ roomTypeId: string }>, res: Response) => {
  const deleted = await db
    .delete(roomType)
    .where(and(eq(roomType.id, req.params.roomTypeId), eq(roomType.organizationId, req.clinicId!)))
    .returning({ id: roomType.id });

  if (deleted.length === 0) {
    return notFound(res, "ROOM_TYPE_NOT_FOUND", "Este tipo de sala no existe en tu clínica");
  }
  res.status(204).end();
};
