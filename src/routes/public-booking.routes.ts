import { Router } from "express";
import {
  cancelPublicAppointment,
  createPublicBooking,
  getPublicAppointment,
  getPublicBooking,
  getPublicSlots,
} from "../controllers/publicBooking.controller.js";

const router = Router();

// Public (no login): the page behind a clinic's booking link or QR. The clinic
// comes from its slug in the URL, and everything answers 404 unless online
// booking is active for it (super-admin's switch AND the clinic's own).
// Creating a booking is limited per IP in the controller

// What can be booked: the clinic, its services and its professionals
router.get("/:slug", getPublicBooking);
// Free slots for a service in a range of dates
router.get("/:slug/slots", getPublicSlots);
router.post("/:slug/appointments", createPublicBooking);

// The patient's own appointment, by the key in the link they got when booking.
// These also work when online booking is switched off
router.get("/:slug/appointments/:token", getPublicAppointment);
router.post("/:slug/appointments/:token/cancel", cancelPublicAppointment);

export default router;
