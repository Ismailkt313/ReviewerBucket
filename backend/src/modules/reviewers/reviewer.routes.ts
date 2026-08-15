import { Router } from "express";
import {
  getAllReviewers,
  getReviewerBySlug,
  createReviewer,
  updateReviewer,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getAllUpdateRequests,
  approveUpdateRequest,
  rejectUpdateRequest
} from "./reviewer.controller";
import { validateSlug, validateCreateReviewer } from "./reviewer.validation";
import { requireAdminAuth } from "../admin-auth/admin-auth.middleware.js";

const router = Router();

router.get("/", getAllReviewers);
router.post("/", validateCreateReviewer, createReviewer);
router.patch("/:id", validateCreateReviewer, updateReviewer);

// Admin-only request management routes
router.get("/requests", requireAdminAuth, getAllRequests);
router.post("/requests/:id/approve", requireAdminAuth, approveRequest);
router.post("/requests/:id/reject", requireAdminAuth, rejectRequest);

// Admin-only update-request management routes
router.get("/update-requests", requireAdminAuth, getAllUpdateRequests);
router.post("/update-requests/:id/approve", requireAdminAuth, approveUpdateRequest);
router.post("/update-requests/:id/reject", requireAdminAuth, rejectUpdateRequest);

router.get("/:slug", validateSlug, getReviewerBySlug);

export default router;
    