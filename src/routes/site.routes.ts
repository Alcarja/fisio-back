import express, { Router } from "express";
import {
  changeSubdomain,
  createPreviewToken,
  deleteSiteImage,
  getSite,
  getSiteImage,
  getSiteTeam,
  publishSite,
  saveDraft,
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
