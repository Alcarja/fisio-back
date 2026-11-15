import express, { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin.js";
import {
  cancelInvitation,
  createClinic,
  createInvitation,
  getAllClinics,
  getClinicById,
  resendInvitation,
  setClinicFeature,
  updateClinic,
  updateMemberRoles,
} from "../controllers/clinic.controller.js";

import {
  deleteClinicDocument,
  downloadClinicDocument,
  getClinicLegal,
  updateClinicLegal,
  uploadClinicDocument,
} from "../controllers/clinicLegal.controller.js";
import { DOCUMENT_FILE_TYPES, MAX_DOCUMENT_BYTES } from "../lib/clinicDocuments.js";

const router = Router();

router.get("/", requireAuth, requireSuperAdmin, getAllClinics);
router.post("/", requireAuth, requireSuperAdmin, createClinic);

router.get("/:clinicId", requireAuth, requireSuperAdmin, getClinicById);
router.patch("/:clinicId", requireAuth, requireSuperAdmin, updateClinic);

// Optional features (e.g. invoicing): on or off per clinic
router.put(
  "/:clinicId/features/:feature",
  requireAuth,
  requireSuperAdmin,
  setClinicFeature,
);

// Documentación: the clinic's legal details and its signed documents
router.get("/:clinicId/legal", requireAuth, requireSuperAdmin, getClinicLegal);
router.put("/:clinicId/legal", requireAuth, requireSuperAdmin, updateClinicLegal);
// The file is the request body. Checked as super-admin before reading it
router.post(
  "/:clinicId/documents",
  requireAuth,
  requireSuperAdmin,
  express.raw({ type: DOCUMENT_FILE_TYPES, limit: MAX_DOCUMENT_BYTES }),
  uploadClinicDocument,
);
router.get(
  "/:clinicId/documents/:documentId/file",
  requireAuth,
  requireSuperAdmin,
  downloadClinicDocument,
);
router.delete(
  "/:clinicId/documents/:documentId",
  requireAuth,
  requireSuperAdmin,
  deleteClinicDocument,
);

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
