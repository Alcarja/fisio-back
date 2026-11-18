import express, { Router } from "express";
import {
  addDomain,
  changeSubdomain,
  checkDomain,
  createPreviewToken,
  deleteSiteImage,
  getSite,
  getSiteImage,
  getSiteTeam,
  publishSite,
  removeDomain,
  saveDraft,
  setPrimaryDomain,
  unpublishSite,
  updateSiteTeamMember,
  uploadSiteImage,
} from "../controllers/site.controller.js";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "../lib/images.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

// Mi web of the session's active clinic (WEBS.md). Owners and admins, in
// clinics with the "website" feature
const siteEditors = [requireAuth, requireActiveClinic(["owner", "admin"]), requireFeature("website")];

const router = Router();

router.get("/", ...siteEditors, getSite);
router.put("/draft", ...siteEditors, saveDraft);
router.put("/subdomain", ...siteEditors, changeSubdomain);
router.post("/publish", ...siteEditors, publishSite);
router.post("/unpublish", ...siteEditors, unpublishSite);
router.post("/preview-token", ...siteEditors, createPreviewToken);

// Own domain (WEBS.md Phase 4)
router.post("/domains", ...siteEditors, addDomain);
router.put("/domains/primary", ...siteEditors, setPrimaryDomain);
router.delete("/domains", ...siteEditors, removeDomain);
router.post("/domains/check", ...siteEditors, checkDomain);

router.get("/images/:imageId", ...siteEditors, getSiteImage);
// The image is the request body. Checked before reading it
router.post(
  "/images",
  ...siteEditors,
  express.raw({ type: IMAGE_TYPES, limit: MAX_IMAGE_BYTES }),
  uploadSiteImage,
);
router.delete("/images/:imageId", ...siteEditors, deleteSiteImage);

router.get("/team", ...siteEditors, getSiteTeam);
router.put("/team/:memberId", ...siteEditors, updateSiteTeamMember);

export default router;
