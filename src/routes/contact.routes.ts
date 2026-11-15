import { Router } from "express";
import { createContactRequest } from "../controllers/contact.controller.js";

const router = Router();

// Public (no login): the website's contact form. Limited per IP in the controller
router.post("/", createContactRequest);

export default router;
