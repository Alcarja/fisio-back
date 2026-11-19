import { Router } from "express";
import {
  addClassMember,
  createAppointment,
  createClass,
  extendClass,
  listClasses,
  previewClass,
  removeClassMember,
  setAttendance,
  createSeries,
  previewSeries,
  updateSeries,
  deleteAppointment,
  linkAppointmentPatient,
  listAppointments,
  updateAppointment,
} from "../controllers/appointment.controller.js";
import { getCalendarConfig } from "../controllers/calendar.controller.js";
import { queuedPerClinic } from "../lib/clinicQueue.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

const router = Router();

// The calendar (Reservas) of the session's active clinic: every clinic role
const clinicStaff = [
  requireAuth,
  requireActiveClinic(["owner", "admin", "receptionist", "physio"]),
];

// Changes that take places (rooms, class places): one at a time per clinic,
// together with online bookings (lib/clinicQueue.ts)
const placeWriters = [...clinicStaff, queuedPerClinic];

// Clinic settings the calendar needs (hours, rooms, services, professionals)
router.get("/config", ...clinicStaff, getCalendarConfig);

// Appointments: everyone in the clinic can see, create, edit and cancel them.
// Deleting is for owners and admins (cancelling keeps the history)
router.get("/appointments", ...clinicStaff, listAppointments);
router.post("/appointments", ...placeWriters, createAppointment);
router.patch("/appointments/:appointmentId", ...placeWriters, updateAppointment);
// Weekly series: which days can be booked, then create them (R1)
router.post("/series/preview", ...clinicStaff, previewSeries);
router.post("/series", ...placeWriters, createSeries);
// Change or cancel "this one and the following" or "all" of a series (R2)
router.post("/series/:seriesId/update", ...placeWriters, updateSeries);
// Group classes (R3): everyone sees them; owners, admins and reception
// create them and manage members (checked in the controller)
router.get("/classes", ...clinicStaff, listClasses);
router.post("/classes/preview", ...clinicStaff, previewClass);
router.post("/classes", ...placeWriters, createClass);
router.post("/classes/:classId/members", ...placeWriters, addClassMember);
router.post("/classes/:classId/members/:memberId/leave", ...clinicStaff, removeClassMember);
router.post("/classes/:classId/extend", ...placeWriters, extendClass);
// Taking attendance in a group session, patient by patient
router.patch("/appointments/:appointmentId/attendance", ...clinicStaff, setAttendance);
// Link a patient without ficha (an online booking) to a ficha, keeping the row
router.post(
  "/appointments/:appointmentId/patients/:rowId/link",
  ...clinicStaff,
  requireFeature("clinical_history"),
  linkAppointmentPatient,
);
router.delete(
  "/appointments/:appointmentId",
  requireAuth,
  requireActiveClinic(["owner", "admin"]),
  deleteAppointment,
);

export default router;
