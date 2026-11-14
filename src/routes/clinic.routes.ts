import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";
import {
  cancelInvitation,
  createClinic,
  createInvitation,
  getAllClinics,
  getClinicById,
  resendInvitation,
  updateClinic,
  updateMemberRoles,
} from "../controllers/clinic.controller.js";

const router = Router();

router.get("/", requireAuth, requireSuperAdmin, getAllClinics);
router.post("/", requireAuth, requireSuperAdmin, createClinic);

router.get("/:clinicId", requireAuth, requireSuperAdmin, getClinicById);
router.patch("/:clinicId", requireAuth, requireSuperAdmin, updateClinic);

// Team: change the role of several members at once (not the owner)
router.patch(
  "/:clinicId/members/roles",
  requireAuth,
  requireSuperAdmin,
  updateMemberRoles,
);

// Pending invitations (e.g. the owner's, sent when the clinic is created)
router.post("/:clinicId/invitations", requireAuth, requireSuperAdmin, createInvitation);
router.post(
  "/:clinicId/invitations/:invitationId/resend",
  requireAuth,
  requireSuperAdmin,
  resendInvitation,
);
router.delete(
  "/:clinicId/invitations/:invitationId",
  requireAuth,
  requireSuperAdmin,
  cancelInvitation,
);

export default router;
