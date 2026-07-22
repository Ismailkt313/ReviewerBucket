import { Request, Response, NextFunction } from "express";
import { RatingService } from "./rating.service";
import { ReviewerBroadcaster } from "../../socket/reviewer.broadcaster.js";

const ratingService = new RatingService();

export const putRating = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reviewerId } = req.params;
    const { anonymousClientId, value } = req.body;
    const updated = await ratingService.submitRating(reviewerId, anonymousClientId, value);

    // Fetch updated summary to broadcast
    const summary = await ratingService.getRatingSummary(reviewerId);
    ReviewerBroadcaster.broadcastReviewerStatsUpdated(reviewerId, {
      averageRating: summary.averageRating,
      ratingCount: summary.ratingCount
    });

    res.status(200).json({
      success: true,
      data: {
        value: updated.value
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getRatingSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reviewerId } = req.params;
    const data = await ratingService.getRatingSummary(reviewerId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
