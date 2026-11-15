import { Router } from "express";
import healthRoutes from "./health.routes.js";
import meRoutes from "./me.routes.js";
import clinicRoutes from "./clinic.routes.js";
import invitationRoutes from "./invitation.routes.js";
import teamRoutes from "./team.routes.js";
import scheduleRoutes from "./schedule.routes.js";
import roomRoutes from "./room.routes.js";
import serviceRoutes from "./service.routes.js";
import calendarRoutes from "./calendar.routes.js";
import reportRoutes from "./report.routes.js";
import billingRoutes from "./billing.routes.js";

const router = Router();

router.use("/", healthRoutes);
router.use("/", meRoutes);
router.use("/admin/clinics", clinicRoutes);
router.use("/admin/billing", billingRoutes);
router.use("/invitations", invitationRoutes);
// The active clinic (from the session): clinic users, by role
router.use("/clinic/team", teamRoutes);
router.use("/clinic/settings/schedule", scheduleRoutes);
router.use("/clinic/settings/rooms", roomRoutes);
router.use("/clinic/settings/services", serviceRoutes);
router.use("/clinic/calendar", calendarRoutes);
router.use("/clinic/reports", reportRoutes);

export default router;
