import { Router } from "express";
import {
  createRoom,
  createRoomType,
  deleteRoom,
  deleteRoomType,
  getRooms,
  updateRoom,
  updateRoomType,
} from "../controllers/room.controller.js";
import { requireActiveClinic } from "../middlewares/requireActiveClinic.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

// Configuración → Salas of the session's active clinic. Owners and admins only
const ownersAndAdmins = [requireAuth, requireActiveClinic(["owner", "admin"])];

// Rooms and room types together
router.get("/", ...ownersAndAdmins, getRooms);

// Room types (declared before /:roomId so "types" isn't read as a room id)
router.post("/types", ...ownersAndAdmins, createRoomType);
router.patch("/types/:roomTypeId", ...ownersAndAdmins, updateRoomType);
router.delete("/types/:roomTypeId", ...ownersAndAdmins, deleteRoomType);

// Rooms
router.post("/", ...ownersAndAdmins, createRoom);
router.patch("/:roomId", ...ownersAndAdmins, updateRoom);
router.delete("/:roomId", ...ownersAndAdmins, deleteRoom);

export default router;
