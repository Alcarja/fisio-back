import { Router } from "express";
import { getBilling, markPaid, setExempt, unmarkPaid } from "../controllers/billing.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";

const router = Router();

// Pagos de las clínicas: super-admins only
const superAdmin = [requireAuth, requireSuperAdmin];

// Every clinic's state for one month (?month=YYYY-MM)
router.get("/", ...superAdmin, getBilling);
// Mark / unmark a month as paid
router.put("/:clinicId/payments/:month", ...superAdmin, markPaid);
router.delete("/:clinicId/payments/:month", ...superAdmin, unmarkPaid);
// "No tiene que pagar"
router.put("/:clinicId/exempt", ...superAdmin, setExempt);

export default router;
