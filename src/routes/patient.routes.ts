import { Router } from "express";
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from "../controllers/patient.controller.js";
import {
  createCase,
  createNote,
  deleteCase,
  deleteNote,
  getClinical,
  updateBackground,
  updateCase,
  updateNote,
} from "../controllers/clinical.controller.js";
import { CLINICAL_ROLES } from "../lib/clinical.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

const router = Router();

// Pacientes of the session's active clinic: every clinic role sees, creates
// and edits them (they all give appointments). The whole section is an optional
// feature: without it, the clinic only writes names on its appointments
const feature = requireFeature("clinical_history");
const clinicStaff = [
  requireAuth,
  requireActiveClinic(["owner", "admin", "receptionist", "physio"]),
  feature,
];

router.get("/", ...clinicStaff, listPatients);
router.post("/", ...clinicStaff, createPatient);
router.get("/:patientId", ...clinicStaff, getPatient);
router.patch("/:patientId", ...clinicStaff, updatePatient);
// Deleting a ficha is for owners and admins
router.delete(
  "/:patientId",
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  feature,
  deletePatient,
);

// Historia clínica (antecedentes, expedientes and their evolution notes):
// health data, so owners, admins and physios only (receptionists get 403)
const clinicalStaff = [requireAuth, requireActiveClinic(CLINICAL_ROLES), feature];

router.get("/:patientId/clinical", ...clinicalStaff, getClinical);
router.patch("/:patientId/clinical", ...clinicalStaff, updateBackground);
router.post("/:patientId/cases", ...clinicalStaff, createCase);
router.patch("/:patientId/cases/:caseId", ...clinicalStaff, updateCase);
router.delete("/:patientId/cases/:caseId", ...clinicalStaff, deleteCase);
router.post("/:patientId/cases/:caseId/notes", ...clinicalStaff, createNote);
router.patch("/:patientId/cases/:caseId/notes/:noteId", ...clinicalStaff, updateNote);
router.delete("/:patientId/cases/:caseId/notes/:noteId", ...clinicalStaff, deleteNote);

export default router;
