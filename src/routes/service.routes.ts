import { Router } from "express";
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from "../controllers/service.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Configuración → Servicios of the session's active clinic. Owners and admins only
const ownersAndAdmins = [requireAuth, requireActiveClinic(["owner", "admin"])];

router.get("/", ...ownersAndAdmins, getServices);
router.post("/", ...ownersAndAdmins, createService);
router.patch("/:serviceId", ...ownersAndAdmins, updateService);
router.delete("/:serviceId", ...ownersAndAdmins, deleteService);

export default router;
