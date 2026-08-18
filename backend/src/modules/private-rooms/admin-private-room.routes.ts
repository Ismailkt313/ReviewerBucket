import { Router } from "express";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import { validateRoomId } from "./private-room.validation.js";
import {
  validateAdminGetQuery,
  validateAdminSendMessage
} from "./admin-private-room.validation.js";
import {
  getAdminPrivateRooms,
  getAdminPrivateUnread,
  getAdminPrivateRoomById,
  getAdminPrivateRoomMessages,
  sendAdminPrivateRoomMessage,
  setAdminRoomLabel,
  markAdminPrivateRoomAsRead
} from "./admin-private-room.controller.js";

const router = Router();

router.use(requireAdminAuth);

router.get("/", validateAdminGetQuery, getAdminPrivateRooms);
router.get("/unread", getAdminPrivateUnread);
router.get("/:roomId", validateRoomId, getAdminPrivateRoomById);
router.post("/:roomId/read", validateRoomId, markAdminPrivateRoomAsRead);
router.patch("/:roomId/label", validateRoomId, setAdminRoomLabel);
router.get("/:roomId/messages", validateRoomId, validateAdminGetQuery, getAdminPrivateRoomMessages);
router.post("/:roomId/messages", validateRoomId, validateAdminSendMessage, sendAdminPrivateRoomMessage);

export default router;
