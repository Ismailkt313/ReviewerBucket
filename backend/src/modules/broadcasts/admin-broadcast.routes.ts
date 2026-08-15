import { Router } from "express";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";
import {
  validateCreateBroadcast,
  validateBroadcastId,
  validateGetBroadcastsQuery
} from "./broadcast.validation.js";
import {
  createAdminBroadcast,
  getAdminBroadcasts,
  getAdminBroadcastById
} from "./broadcast.controller.js";

const router = Router();

router.use(requireAdminAuth);

router.post("/", validateCreateBroadcast, createAdminBroadcast);
router.get("/", validateGetBroadcastsQuery, getAdminBroadcasts);
router.get("/:id", validateBroadcastId, getAdminBroadcastById);

export default router;
