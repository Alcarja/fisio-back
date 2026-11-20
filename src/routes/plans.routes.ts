import { Router } from "express";
import { countProfessionalAlerts, createPlan, deletePlan, listContracts, listPlans, setFeaturePrice, updatePlan } from "../controllers/plans.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";

const router = Router();

// Planes y precios: super-admins only
const superAdmin = [requireAuth, requireSuperAdmin];

router.get("/", ...superAdmin, listPlans);
router.post("/", ...superAdmin, createPlan);
// Every clinic's contract (Contratos dashboard). Before /:planId
router.get("/contracts", ...superAdmin, listContracts);
// How many clinics need a look (tier changes, professionals fixed too low)
router.get("/alerts", ...superAdmin, countProfessionalAlerts);
// What a feature costs as an extra (before /:planId so it isn't read as a plan)
router.put("/feature-prices/:feature", ...superAdmin, setFeaturePrice);
router.put("/:planId", ...superAdmin, updatePlan);
router.delete("/:planId", ...superAdmin, deletePlan);

export default router;
