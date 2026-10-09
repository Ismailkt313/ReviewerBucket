import { Router } from "express";
import { putRating, getRatingSummary } from "./rating.controller.js";
import { validateReviewerId, validatePutRating } from "./rating.validation.js";
import { ratingSubmissionLimiter } from "./rating.limiter.js";

const router = Router();

router.put(
  "/:reviewerId/rating",
  ratingSubmissionLimiter,
  validateReviewerId,
  validatePutRating,
  putRating
);
router.get("/:reviewerId/rating-summary", validateReviewerId, getRatingSummary);

export default router;
