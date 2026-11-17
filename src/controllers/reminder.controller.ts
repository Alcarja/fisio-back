import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { clinicReminderSettings } from "../db/schema.js";
import { getReminderStatus, parseReminderSettings } from "../lib/reminders.js";

// Configuración → Recordatorios of the active clinic (owners and admins).
// Every route also needs the "reminders" feature (requireFeature): the
// super-admin's switch comes first, the clinic's own switch is managed here.

const badRequest = (res: Response, code: string, message: string) =>
  res.status(400).json({ error: { code, message } });

// GET /clinic/settings/reminders -> { enabled, settings }
export const getReminders = async (req: Request, res: Response) => {
  const { enabled, settings } = await getReminderStatus(req.clinicId!);
  res.json({ enabled, settings });
};

// PATCH /clinic/settings/reminders   body: { enabled: boolean } -> { enabled }
export const setRemindersEnabled = async (req: Request, res: Response) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    return badRequest(res, "INVALID_ENABLED", "enabled debe ser true o false");
  }
  await db
    .insert(clinicReminderSettings)
    .values({ organizationId: req.clinicId!, enabled, updatedBy: req.user!.id })
    .onConflictDoUpdate({
      target: clinicReminderSettings.organizationId,
      set: { enabled, updatedBy: req.user!.id, updatedAt: new Date() },
    });
  res.json({ enabled });
};

// PUT /clinic/settings/reminders/settings -> { settings }
// body: { timing, sendTime, hoursBefore, includeService, replyTo, extraText }
// Applies from now on to reminders not sent yet
export const updateReminderSettings = async (req: Request, res: Response) => {
  const settings = parseReminderSettings(req.body ?? {});
  if (typeof settings === "string") return badRequest(res, "INVALID_SETTINGS", settings);
  await db
    .insert(clinicReminderSettings)
    .values({ organizationId: req.clinicId!, ...settings, updatedBy: req.user!.id })
    .onConflictDoUpdate({
      target: clinicReminderSettings.organizationId,
      set: { ...settings, updatedBy: req.user!.id, updatedAt: new Date() },
    });
  res.json({ settings });
};
