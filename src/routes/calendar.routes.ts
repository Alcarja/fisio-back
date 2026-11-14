import { Router } from "express";
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
} from "../controllers/appointment.controller.js";
import { getCalendarConfig } from "../controllers/calendar.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// The calendar (Reservas) of the session's active clinic: every clinic role
const clinicStaff = [
  requireAuth,
  requireActiveClinic(["owner", "admin", "receptionist", "physio"]),
];

// Clinic settings the calendar needs (hours, rooms, services, professionals)
router.get("/config", ...clinicStaff, getCalendarConfig);

// Appointments: everyone in the clinic can see, create, edit and cancel them.
// Deleting is for owners and admins (cancelling keeps the history)
router.get("/appointments", ...clinicStaff, listAppointments);
router.post("/appointments", ...clinicStaff, createAppointment);
router.patch("/appointments/:appointmentId", ...clinicStaff, updateAppointment);
router.delete(
  "/appointments/:appointmentId",
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  deleteAppointment,
);

export default router;
