import { Router } from "express";
import {
  addMember,
  getTeam,
  removeMember,
  setMemberPassword,
  updateMemberRole,
} from "../controllers/team.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Everything here works on the session's active clinic. Owners and admins only
const ownersAndAdmins = [requireAuth, requireActiveClinic(["owner", "admin"])];

// The active clinic's team
router.get("/", ...ownersAndAdmins, getTeam);

// Add someone (existing account or a new one)
router.post("/newMember", ...ownersAndAdmins, addMember);

// Manage a member (never the owner or yourself)
router.patch("/members/:memberId/role", ...ownersAndAdmins, updateMemberRole);
router.post("/members/:memberId/password", ...ownersAndAdmins, setMemberPassword);
router.delete("/members/:memberId", ...ownersAndAdmins, removeMember);

export default router;
