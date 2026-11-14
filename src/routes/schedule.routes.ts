import { Router } from "express";
import {
  createException,
  deleteException,
  getSchedule,
  updateTimezone,
  updateWeeklyHours,
} from "../controllers/schedule.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Configuración → Horario of the session's active clinic. Owners and admins only
const ownersAndAdmins = [requireAuth, requireActiveClinic(["owner", "admin"])];

router.get("/", ...ownersAndAdmins, getSchedule);
router.put("/hours", ...ownersAndAdmins, updateWeeklyHours);
router.patch("/timezone", ...ownersAndAdmins, updateTimezone);
router.post("/exceptions", ...ownersAndAdmins, createException);
router.delete("/exceptions/:exceptionId", ...ownersAndAdmins, deleteException);

export default router;
