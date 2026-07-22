import { Request, Response, NextFunction } from "express";
import { ReviewerService } from "./reviewer.service";
import { ReviewerUpdateRequestService } from "./reviewer-update-request.service";
import { ReviewerBroadcaster } from "../../socket/reviewer.broadcaster.js";

const reviewerService = new ReviewerService();
const updateRequestService = new ReviewerUpdateRequestService();

export const getAllReviewers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reviewers = await reviewerService.getAllReviewersWithStats();
    const data = reviewers.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      code: r.code,
      slug: r.slug,
      stacks: r.stacks,
      stats: r.stats
    }));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewerBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const reviewer = await reviewerService.getReviewerBySlug(slug);
    const data = {
      id: reviewer._id.toString(),
      name: reviewer.name,
      code: reviewer.code,
      slug: reviewer.slug,
      stacks: reviewer.stacks
    };

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

export const createReviewer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, code, stacks } = req.body;
    
    // Create reviewer document directly as PENDING
    const reviewer = await reviewerService.createReviewer({
      name,
      code,
      stacks,
      status: "PENDING"
    });

    res.status(201).json({
      success: true,
      message: "Reviewer request submitted successfully.",
      data: {
        id: reviewer._id.toString(),
        reviewerName: reviewer.name,
        reviewerCode: reviewer.code,
        status: reviewer.status,
        requestedAt: reviewer.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateReviewer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, stacks } = req.body;

    const request = await updateRequestService.submitUpdateRequest({
      reviewerId: id,
      name,
      code,
      stacks
    });

    res.status(201).json({
      success: true,
      message: "Update request submitted successfully.",
      data: {
        id: request._id.toString(),
        reviewerId: request.reviewerId.toString(),
        proposedData: request.proposedData,
        status: request.status,
        requestedAt: request.requestedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllRequests = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requests = await reviewerService.getAllRequests();
    res.status(200).json({
      success: true,
      data: requests.map((r) => ({
        id: r._id.toString(),
        reviewerName: r.name,
        reviewerCode: r.code,
        stacks: r.stacks,
        status: r.status,
        requestedAt: r.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const approveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const reviewer = await reviewerService.approveReviewerRequest(id);

    const reviewerData = {
      id: reviewer._id.toString(),
      name: reviewer.name,
      code: reviewer.code,
      slug: reviewer.slug,
      stacks: reviewer.stacks,
      stats: {
        averageRating: null,
        ratingCount: 0,
        experienceCount: 0,
        lastUpdated: null
      }
    };

    // Broadcast reviewer approval to all connected sockets
    ReviewerBroadcaster.broadcastReviewerApproved(reviewerData);

    // Trigger reviewer approved notification asynchronously
    import("../notifications/notification.service.js")
      .then(({ notificationService }) => {
        notificationService.createNotification(
          "reviewer_approved",
          `A new reviewer has been approved: ${reviewer.code} - ${reviewer.name}`,
          undefined,
          {
            reviewerId: reviewer._id.toString(),
            reviewerSlug: reviewer.slug
          }
        );
      })
      .catch((err) => {
        console.error("Failed to create reviewer approved notification:", err);
      });

    res.status(200).json({
      success: true,
      data: {
        id: reviewer._id.toString(),
        reviewerName: reviewer.name,
        reviewerCode: reviewer.code,
        status: reviewer.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const reviewer = await reviewerService.rejectReviewerRequest(id);

    res.status(200).json({
      success: true,
      data: {
        id: reviewer._id.toString(),
        reviewerName: reviewer.name,
        reviewerCode: reviewer.code,
        status: reviewer.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUpdateRequests = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requests = await updateRequestService.getAllRequests();
    res.status(200).json({
      success: true,
      data: requests.map((r) => ({
        id: r._id.toString(),
        reviewerId: r.reviewerId,
        proposedData: r.proposedData,
        status: r.status,
        requestedAt: r.requestedAt,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        rejectionReason: r.rejectionReason
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const approveUpdateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reviewedBy } = req.body;

    const request = await updateRequestService.approveUpdateRequest(id, reviewedBy);

    // Fetch updated reviewer doc to broadcast updated fields
    try {
      const updatedReviewer = await reviewerService.getReviewerById(request.reviewerId.toString());
      if (updatedReviewer) {
        ReviewerBroadcaster.broadcastReviewerUpdated({
          id: updatedReviewer._id.toString(),
          name: updatedReviewer.name,
          code: updatedReviewer.code,
          slug: updatedReviewer.slug,
          stacks: updatedReviewer.stacks
        });
      }
    } catch {
      // Ignore broadcast fetch error
    }

    res.status(200).json({
      success: true,
      data: {
        id: request._id.toString(),
        reviewerId: request.reviewerId.toString(),
        status: request.status,
        reviewedAt: request.reviewedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectUpdateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejectionReason, reviewedBy } = req.body;

    const request = await updateRequestService.rejectUpdateRequest(id, rejectionReason, reviewedBy);

    res.status(200).json({
      success: true,
      data: {
        id: request._id.toString(),
        reviewerId: request.reviewerId.toString(),
        status: request.status,
        rejectionReason: request.rejectionReason,
        reviewedAt: request.reviewedAt
      }
    });
  } catch (error) {
    next(error);
  }
};
