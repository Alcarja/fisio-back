import { Router } from "express";
import { getPublicInvitation } from "../controllers/invitation.controller.js";

const router = Router();

// Public (no login): used by the frontend's accept-invitation page.
// Accepting itself goes through Better Auth: POST /api/auth/organization/accept-invitation
router.get("/:invitationId", getPublicInvitation);

export default router;
