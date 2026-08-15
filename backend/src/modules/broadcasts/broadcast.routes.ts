import { Router } from "express";
import { validateGetBroadcastsQuery } from "./broadcast.validation.js";
import {
  getUserBroadcasts,
  getBroadcastUnreadCount,
  markBroadcastsAsRead
} from "./broadcast.controller.js";

const router = Router();

router.get("/", validateGetBroadcastsQuery, getUserBroadcasts);
router.get("/unread", getBroadcastUnreadCount);
router.put("/read", markBroadcastsAsRead);

export default router;
