import { Router } from "express";
import {
  sendPrivateMessage,
  getPrivateMessages
} from "./private-message.controller.js";
import {
  validateRoomId,
  validateSendPrivateMessage,
  validateGetPrivateMessagesQuery
} from "./private-message.validation.js";

const router = Router({ mergeParams: true });

router.post("/:roomId/messages", validateRoomId, validateSendPrivateMessage, sendPrivateMessage);
router.get("/:roomId/messages", validateRoomId, validateGetPrivateMessagesQuery, getPrivateMessages);

export default router;
