import { Router } from "express";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import { validateRoomId } from "./private-room.validation.js";
import {
  validateAdminGetQuery,
  validateAdminSendMessage
} from "./admin-private-room.validation.js";
import {
  getAdminPrivateRooms,
  getAdminPrivateRoomById,
  getAdminPrivateRoomMessages,
  sendAdminPrivateRoomMessage,
  setAdminRoomLabel
} from "./admin-private-room.controller.js";

const router = Router();

router.use(requireAdminAuth);

router.get("/", validateAdminGetQuery, getAdminPrivateRooms);
router.get("/:roomId", validateRoomId, getAdminPrivateRoomById);
router.patch("/:roomId/label", validateRoomId, setAdminRoomLabel);
router.get("/:roomId/messages", validateRoomId, validateAdminGetQuery, getAdminPrivateRoomMessages);
router.post("/:roomId/messages", validateRoomId, validateAdminSendMessage, sendAdminPrivateRoomMessage);

export default router;
