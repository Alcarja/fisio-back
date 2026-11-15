import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { contactRequest } from "../db/schema.js";
import { sendTemplate } from "../lib/email/index.js";

// Public "contact us" form (the website's /contacto page). Anyone can call it,
// so: strict validation, a hidden trap field for bots and a limit per IP.

// Where new requests are announced
const notifyTo =
  process.env.CONTACT_NOTIFY_EMAIL ||
  process.env.EMAIL_SUPPORT_ADDRESS ||
  process.env.SUPERADMIN_EMAIL;

const TEAM_SIZES: Record<string, string> = {
  solo: "Solo yo",
  "2-5": "De 2 a 5 personas",
  "6-15": "De 6 a 15 personas",
  "16+": "Más de 15 personas",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Limit per IP (in memory: enough for one server process) ----------

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;
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

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

// Trimmed text, or null if empty. undefined if it isn't text or is too long
function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed || null;
}

// POST /contact   body: { name, email, clinicName, phone?, teamSize?, message?, website? }
// -> 201. "website" is the trap: hidden in the form, only bots fill it in
export const createContactRequest = async (req: Request, res: Response) => {
  const body = req.body ?? {};

  // Bots get the same answer as everyone else, but nothing is saved or sent
  if (typeof body.website === "string" && body.website.trim() !== "") {
    res.status(201).json({ ok: true });
    return;
  }

  if (tooMany(req.ip ?? "unknown")) {
    return send(
      res,
      429,
      "TOO_MANY_REQUESTS",
      "Has enviado varias solicitudes seguidas. Inténtalo dentro de un rato.",
    );
  }

  const name = text(body.name, 100);
  const email = text(body.email, 200)?.toLowerCase();
  const clinicName = text(body.clinicName, 150);
  const phone = text(body.phone, 30);
  const message = text(body.message, 2000);
  const teamSize = typeof body.teamSize === "string" && body.teamSize in TEAM_SIZES
    ? body.teamSize
    : null;

  if (!name) return send(res, 400, "INVALID_NAME", "Escribe tu nombre");
  if (!email || !EMAIL_PATTERN.test(email)) {
    return send(res, 400, "INVALID_EMAIL", "El email no es válido");
  }
  if (!clinicName) return send(res, 400, "INVALID_CLINIC", "Escribe el nombre de tu clínica");
  if (phone === undefined || (phone && !/^[\d\s+().-]{6,30}$/.test(phone))) {
    return send(res, 400, "INVALID_PHONE", "El teléfono no es válido");
  }
  if (message === undefined) {
    return send(res, 400, "INVALID_MESSAGE", "El mensaje puede tener como máximo 2000 caracteres");
  }

  await db.insert(contactRequest).values({ name, email, clinicName, phone, teamSize, message });

  if (notifyTo) {
    // Never fails the request: it's saved even if the email doesn't go out
    await sendTemplate(
      "contactRequest",
      notifyTo,
      { name, email, clinicName, phone, teamSize: teamSize && TEAM_SIZES[teamSize]!, message },
      { name: "Kineflow · Web", replyTo: email },
    );
  } else {
    console.warn("[contact] New request saved, but CONTACT_NOTIFY_EMAIL is not set");
  }

  res.status(201).json({ ok: true });
};

// ---------- Super-admin: the requests inbox (contact-admin.routes.ts) ----------

// GET /admin/contact-requests -> { requests } newest first. teamSize comes as
// its label ("De 2 a 5 personas")
export const listContactRequests = async (_req: Request, res: Response) => {
  const rows = await db.select().from(contactRequest).orderBy(desc(contactRequest.createdAt));
  res.json({
    requests: rows.map((r) => ({
      ...r,
      teamSize: r.teamSize ? (TEAM_SIZES[r.teamSize] ?? r.teamSize) : null,
    })),
  });
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

type RequestParams = { requestId: string };

// PATCH /admin/contact-requests/:requestId   body: { handled: boolean } -> 204
export const updateContactRequest = async (req: Request<RequestParams>, res: Response) => {
  const { handled } = req.body ?? {};
  if (typeof handled !== "boolean") {
    return send(res, 400, "INVALID_HANDLED", "handled debe ser true o false");
  }
  if (!isUuid(req.params.requestId)) return send(res, 404, "NOT_FOUND", "Esta solicitud no existe");

  const updated = await db
    .update(contactRequest)
    .set({ handled })
    .where(eq(contactRequest.id, req.params.requestId))
    .returning({ id: contactRequest.id });
  if (updated.length === 0) return send(res, 404, "NOT_FOUND", "Esta solicitud no existe");
  res.status(204).end();
};

// DELETE /admin/contact-requests/:requestId -> 204 (spam, duplicates)
export const deleteContactRequest = async (req: Request<RequestParams>, res: Response) => {
  if (!isUuid(req.params.requestId)) return send(res, 404, "NOT_FOUND", "Esta solicitud no existe");
  const deleted = await db
    .delete(contactRequest)
    .where(eq(contactRequest.id, req.params.requestId))
    .returning({ id: contactRequest.id });
  if (deleted.length === 0) return send(res, 404, "NOT_FOUND", "Esta solicitud no existe");
  res.status(204).end();
};
