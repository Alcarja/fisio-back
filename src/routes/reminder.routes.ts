import { Router } from "express";
import {
  getReminders,
  setRemindersEnabled,
  updateReminderSettings,
} from "../controllers/reminder.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

const router = Router();

// Configuración → Recordatorios of the session's active clinic. Owners and
// admins, and only in clinics where a super-admin switched the feature on
const ownersAndAdmins = [
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  requireFeature("reminders"),
];

router.get("/", ...ownersAndAdmins, getReminders);
// The clinic's own switch
router.patch("/", ...ownersAndAdmins, setRemindersEnabled);
// When they're sent and what they say
router.put("/settings", ...ownersAndAdmins, updateReminderSettings);

export default router;
