import { Router } from "express";
import { getMe } from "../controllers/me.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, getMe);

export default router;
