import { Router } from "express";
import { getMonthlyReport } from "../controllers/report.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Informes of the session's active clinic. Owners and admins only: physios and
// receptionists get 403 (the clinic comes from the session, never the URL)
const ownersAndAdmins = [requireAuth, requireActiveClinic(["owner", "admin"])];

// Appointments of one month per physio × service (?month=YYYY-MM)
router.get("/monthly", ...ownersAndAdmins, getMonthlyReport);

export default router;
