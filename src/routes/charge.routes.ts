import { Router } from "express";
import {
  cancelManual,
  createManual,
  createPayment,
  deleteWaive,
  exportMonth,
  listMovements,
  listArchive,
  getPayment,
  getSettings,
  listPending,
  listSessions,
  postMove,
  postRefund,
  postVoid,
  postOutcome,
  putPrice,
  putWaive,
  updateSettings,
} from "../controllers/charge.controller.js";
import {
  createBonoType,
  deleteBonoType,
  deleteSessionBono,
  getBonos,
  getBonoTypes,
  getSessionBonos,
  putSessionBono,
  postBono,
  postBonoCancel,
  postBonoPay,
  updateBonoType,
} from "../controllers/bono.controller.js";
import { CHARGE_MANAGER_ROLES, CHARGE_ROLES } from "../lib/charges.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireFeature } from "../middlewares/requireFeature.js";

const router = Router();

// Cobros y bonos of the session's active clinic (COBROS.md), only in clinics
// where a super-admin switched "invoicing" on.
// Staff: owners, admins and reception. Managers: owners and admins
const staff = [requireAuth, requireActiveClinic(CHARGE_ROLES), requireFeature("invoicing")];
const managers = [
  requireAuth,
  requireActiveClinic(CHARGE_MANAGER_ROLES),
  requireFeature("invoicing"),
];

// Fecha de inicio and whether no-shows are charged: everyone working with
// charges needs them, only managers change them
router.get("/settings", ...staff, getSettings);
router.put("/settings", ...managers, updateSettings);
// The month's payments as a CSV for the accountant (patients' NIF and address).
// Without requireFeature on purpose: a clinic that stops using Cobros must
// still be able to get its records out (it has to keep them for years)
const managersAlways = [requireAuth, requireActiveClinic(CHARGE_MANAGER_ROLES)];
router.get("/export", ...managersAlways, exportMonth);
// The months that have payments, to offer their export when Cobros is off
router.get("/archive", ...managersAlways, listArchive);

// Registro de sesiones: every patient of every appointment, with where it
// stands for charging (?from&to)
router.get("/sessions", ...staff, listSessions);
// Everything still to sort out since the start date (pending, to confirm, review)
router.get("/pending", ...staff, listPending);
// All the money of a month (Movimientos): owners, admins and reception, who
// close the cash register. Without NIF or addresses (those go in the CSV only)
router.get("/movements", ...staff, listMovements);
// A session's price and "sin cargo" (:sessionId = ChargeSession.id)
router.put("/sessions/:sessionId/price", ...staff, putPrice);
// Came / didn't come, for a session nobody marked in the calendar
router.post("/sessions/:sessionId/outcome", ...staff, postOutcome);
router.put("/sessions/:sessionId/waive", ...staff, putWaive);
router.delete("/sessions/:sessionId/waive", ...staff, deleteWaive);
// Sessions that aren't in the calendar
router.post("/manual-sessions", ...staff, createManual);
router.post("/manual-sessions/:sessionId/cancel", ...staff, cancelManual);

// Payments. Voiding checks the role inside: managers always, reception only
// their own payments of the same day (lib/payments.ts)
router.post("/payments", ...staff, createPayment);
router.get("/payments/:paymentId", ...staff, getPayment);
router.post("/payments/:paymentId/void", ...staff, postVoid);
router.post("/payments/:paymentId/refund", ...staff, postRefund);
router.post("/payments/:paymentId/move", ...staff, postMove);

// Bono types: reception lists them (to sell), owners and admins manage them
router.get("/bono-types", ...staff, getBonoTypes);
router.post("/bono-types", ...managers, createBonoType);
router.put("/bono-types/:bonoTypeId", ...managers, updateBonoType);
router.delete("/bono-types/:bonoTypeId", ...managers, deleteBonoType);

// Bonos sold: owners, admins and reception sell, charge and cancel them.
// Refunding when cancelling follows the refund rule (lib/bonos.ts)
router.get("/bonos", ...staff, getBonos);
router.post("/bonos", ...staff, postBono);
router.post("/bonos/:bonoId/pay", ...staff, postBonoPay);
router.post("/bonos/:bonoId/cancel", ...staff, postBonoCancel);
// Paying a session with a bono (and undoing it)
router.get("/sessions/:sessionId/bonos", ...staff, getSessionBonos);
router.put("/sessions/:sessionId/bono", ...staff, putSessionBono);
router.delete("/sessions/:sessionId/bono", ...staff, deleteSessionBono);

export default router;
