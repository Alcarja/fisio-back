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
  getClinicalLog,
  updateBackground,
  updateCase,
  updateNote,
} from "../controllers/clinical.controller.js";
import { exportClinic, exportPatient } from "../controllers/export.controller.js";
import {
  createProgram,
  finishProgram,
  getProgramItemImage,
  listPrograms,
  updateProgram,
} from "../controllers/program.controller.js";
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

// Everything the clinic holds, as a file (before "/:patientId", which would
// take "export" for an id). Not behind the feature: a clinic can still take
// its data with it after the section is switched off
router.get("/export", requireAuth, requireActiveClinic(["owner", "admin"]), exportClinic);

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
// One patient's data and whole history, to hand over to them
router.get("/:patientId/export", ...clinicalStaff, exportPatient);
// Exercises for home (programas), inside an expediente
router.get("/:patientId/programs", ...clinicalStaff, listPrograms);
router.post("/:patientId/cases/:caseId/programs", ...clinicalStaff, createProgram);
router.put("/:patientId/programs/:programId", ...clinicalStaff, updateProgram);
router.post("/:patientId/programs/:programId/finish", ...clinicalStaff, finishProgram);
router.get("/:patientId/programs/:programId/items/:itemId/image", ...clinicalStaff, getProgramItemImage);

// Who saw and changed the history, and what it said before: owners and admins
router.get(
  "/:patientId/log",
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  feature,
  getClinicalLog,
);
router.patch("/:patientId/clinical", ...clinicalStaff, updateBackground);
router.post("/:patientId/cases", ...clinicalStaff, createCase);
router.patch("/:patientId/cases/:caseId", ...clinicalStaff, updateCase);
router.delete("/:patientId/cases/:caseId", ...clinicalStaff, deleteCase);
router.post("/:patientId/cases/:caseId/notes", ...clinicalStaff, createNote);
router.patch("/:patientId/cases/:caseId/notes/:noteId", ...clinicalStaff, updateNote);
router.delete("/:patientId/cases/:caseId/notes/:noteId", ...clinicalStaff, deleteNote);

export default router;
