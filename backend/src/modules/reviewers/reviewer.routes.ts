import { Router } from "express";
import { getAllReviewers, getReviewerBySlug, createReviewer, updateReviewer } from "./reviewer.controller";
import { validateSlug, validateCreateReviewer } from "./reviewer.validation";

const router = Router();

router.get("/", getAllReviewers);
router.post("/", validateCreateReviewer, createReviewer);
router.patch("/:id", validateCreateReviewer, updateReviewer);
router.get("/:slug", validateSlug, getReviewerBySlug);

export default router;
    