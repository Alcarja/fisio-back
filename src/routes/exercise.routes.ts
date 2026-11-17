import express, { Router } from "express";
import {
  archiveExercise,
  createExercise,
  createTemplate,
  deleteExerciseImage,
  deleteTemplate,
  duplicateExercise,
  getExerciseImage,
  listExercises,
  listTemplates,
  updateExercise,
  updateTemplate,
  uploadExerciseImage,
} from "../controllers/exercise.controller.js";
import { listActivePrograms } from "../controllers/program.controller.js";
import { EXERCISE_IMAGE_TYPES, EXERCISE_ROLES, MAX_EXERCISE_IMAGE_BYTES } from "../lib/exercises.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

// Ejercicios of the session's active clinic: the bank and the tablas.
// Owners, admins and physios, in clinics with the Pacientes section
// ("clinical_history"): exercises are given inside the patients' expedientes
const clinicalStaff = [
  requireAuth,
  requireActiveClinic(EXERCISE_ROLES),
  requireFeature("clinical_history"),
];

export const exerciseRouter = Router();
exerciseRouter.get("/", ...clinicalStaff, listExercises);
exerciseRouter.post("/", ...clinicalStaff, createExercise);
exerciseRouter.put("/:exerciseId", ...clinicalStaff, updateExercise);
exerciseRouter.delete("/:exerciseId", ...clinicalStaff, archiveExercise);
exerciseRouter.post("/:exerciseId/duplicate", ...clinicalStaff, duplicateExercise);
exerciseRouter.get("/:exerciseId/image", ...clinicalStaff, getExerciseImage);
// The image is the request body. Checked before reading it
exerciseRouter.put(
  "/:exerciseId/image",
  ...clinicalStaff,
  express.raw({ type: EXERCISE_IMAGE_TYPES, limit: MAX_EXERCISE_IMAGE_BYTES }),
  uploadExerciseImage,
);
exerciseRouter.delete("/:exerciseId/image", ...clinicalStaff, deleteExerciseImage);

// Who has exercises for home right now
export const programsRouter = Router();
programsRouter.get("/", ...clinicalStaff, listActivePrograms);

export const templateRouter = Router();
templateRouter.get("/", ...clinicalStaff, listTemplates);
templateRouter.post("/", ...clinicalStaff, createTemplate);
templateRouter.put("/:templateId", ...clinicalStaff, updateTemplate);
templateRouter.delete("/:templateId", ...clinicalStaff, deleteTemplate);
