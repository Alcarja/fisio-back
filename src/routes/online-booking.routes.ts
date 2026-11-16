import { Router } from "express";
import {
  getOnlineBooking,
  setOnlineBookingEnabled,
  updateBookingRules,
  updateProfessionalBookingHours,
} from "../controllers/onlineBooking.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

const router = Router();

// Configuración → Reserva online of the session's active clinic.
// Owners and admins, and only in clinics where a super-admin switched the
// feature on: without it, the clinic can't see or change anything here
const ownersAndAdmins = [
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  requireFeature("online_booking"),
];

router.get("/", ...ownersAndAdmins, getOnlineBooking);
// The clinic's own switch
router.patch("/", ...ownersAndAdmins, setOnlineBookingEnabled);
// Booking and cancellation criteria
router.put("/rules", ...ownersAndAdmins, updateBookingRules);
// When each professional accepts online bookings
router.put("/professionals/:memberId/hours", ...ownersAndAdmins, updateProfessionalBookingHours);

export default router;
