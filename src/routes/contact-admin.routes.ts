import { Router } from "express";
import {
  deleteContactRequest,
  listContactRequests,
  updateContactRequest,
} from "../controllers/contact.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";

const router = Router();

// The website's contact requests (Plataforma → Solicitudes): super-admins only
const superAdmin = [requireAuth, requireSuperAdmin];

router.get("/", ...superAdmin, listContactRequests);
router.patch("/:requestId", ...superAdmin, updateContactRequest);
router.delete("/:requestId", ...superAdmin, deleteContactRequest);

export default router;
