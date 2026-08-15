import { Router } from "express";
import {
  createOrGetPrivateRoom,
  createOrGetDeveloperRoom,
  getMyPrivateRooms,
  getPrivateRoomById,
  getMyPrivateUnread,
  markPrivateRoomAsRead
} from "./private-room.controller.js";
import {
  validateAnonymousClientId,
  validateCreatePrivateRoom,
  validateGetPrivateRoomsQuery,
  validateRoomId
} from "./private-room.validation.js";

const router = Router();

router.post("/developer", validateAnonymousClientId, createOrGetDeveloperRoom);
router.post("/", validateCreatePrivateRoom, createOrGetPrivateRoom);
router.get("/", validateGetPrivateRoomsQuery, getMyPrivateRooms);
router.get("/unread", getMyPrivateUnread);
router.put("/:roomId/read", validateRoomId, markPrivateRoomAsRead);
router.get("/:roomId", validateRoomId, getPrivateRoomById);

export default router;
