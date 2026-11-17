import { Router } from "express";
import { getPublicProgram, getPublicProgramImage } from "../controllers/program.controller.js";

// Public (no login): a patient's exercises, by the key in their link or QR
const router = Router();
router.get("/:token", getPublicProgram);
router.get("/:token/items/:itemId/image", getPublicProgramImage);
export default router;
