import { Request, Response, NextFunction } from "express";
import { ExperienceService } from "./experience.service.js";
import { ReviewerModel } from "../reviewers/reviewer.model.js";
import { ReviewerBroadcaster } from "../../socket/reviewer.broadcaster.js";

const experienceService = new ExperienceService();

export const postExperience = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { reviewerId } = req.params;
  const { content, anonymousClientId } = req.body;
  const contentPreview = content ? (content.substring(0, 30) + (content.length > 30 ? "..." : "")) : "";

  console.log(`[EXPERIENCE_SUBMISSION] [START] Initiating experience submit for reviewerId=${reviewerId}, contentPreview="${contentPreview}"`);

  try {
    const experience = await experienceService.submitExperience(reviewerId, content);
    console.log(`[EXPERIENCE_SUBMISSION] [SUCCESS] Experience created in DB: id=${experience._id.toString()} for reviewerId=${reviewerId}`);

    try {
      const { ExperienceBroadcaster } = await import("../../socket/experience.broadcaster.js");
      ExperienceBroadcaster.broadcastNewExperience({
        id: experience._id.toString(),
        reviewerId: experience.reviewerId.toString(),
        content: experience.content,
        createdAt: experience.createdAt
      });
      console.log(`[EXPERIENCE_SUBMISSION] [BROADCAST] Broadcasted new experience id=${experience._id.toString()}`);
    } catch (err) {
      console.error(`[EXPERIENCE_SUBMISSION] [ERROR] Failed to broadcast experience id=${experience._id.toString()}:`, err);
    }

    // Trigger experience shared notification asynchronously and broadcast stats update
    ReviewerModel.findById(reviewerId)
      .then((reviewer) => {
        if (reviewer) {
          ReviewerBroadcaster.broadcastReviewerStatsUpdated(reviewerId, {
            lastUpdated: experience.createdAt
          });

          import("../notifications/notification.service.js")
            .then(({ notificationService }) => {
              notificationService.createNotification(
                "new_experience",
                `A new experience was shared for ${reviewer.code}.`,
                anonymousClientId,
                {
                  experienceId: experience._id.toString(),
                  reviewerId: reviewer._id.toString(),
                  reviewerSlug: reviewer.slug
                }
              );
            })
            .catch((err) => {
              console.error("Failed to create experience notification:", err);
            });
        }
      })
      .catch((err) => {
        console.error("Failed to find reviewer for experience notification:", err);
      });

    res.status(201).json({
      success: true,
      message: "Experience submitted successfully.",
      data: {
        id: experience._id.toString(),
        reviewerId: experience.reviewerId.toString(),
        content: experience.content,
        createdAt: experience.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error(`[EXPERIENCE_SUBMISSION] [FAILURE] Error submitting experience for reviewerId=${reviewerId}:`, error);
    next(error);
  }
};

export const getExperiences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reviewerId } = req.params;
    const { limit, cursor } = req.query as unknown as { limit: number; cursor?: string };

    const result = await experienceService.getExperiences(reviewerId, limit, cursor);

    const experiences = result.experiences.map((exp) => ({
      id: exp._id.toString(),
      content: exp.content,
      createdAt: exp.createdAt.toISOString()
    }));

    const responseData = {
      experiences,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};
