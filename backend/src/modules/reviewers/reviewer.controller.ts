import { Request, Response, NextFunction } from "express";
import { ReviewerService } from "./reviewer.service";

const reviewerService = new ReviewerService();

export const getAllReviewers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reviewers = await reviewerService.getAllReviewers();
    const data = reviewers.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      code: r.code,
      slug: r.slug,
      stacks: r.stacks
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
    res.status(200).json({
      success: true,
      data: {
        id: reviewer._id.toString(),
        name: reviewer.name,
        code: reviewer.code,
        slug: reviewer.slug,
        stacks: reviewer.stacks
      }
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
    const reviewer = await reviewerService.createReviewer({ name, code, stacks });
    res.status(201).json({
      success: true,
      data: {
        id: reviewer._id.toString(),
        name: reviewer.name,
        code: reviewer.code,
        slug: reviewer.slug,
        stacks: reviewer.stacks
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
    const reviewer = await reviewerService.updateReviewer(id, { name, code, stacks });
    res.status(200).json({
      success: true,
      data: {
        id: reviewer._id.toString(),
        name: reviewer.name,
        code: reviewer.code,
        slug: reviewer.slug,
        stacks: reviewer.stacks
      }
    });
  } catch (error) {
    next(error);
  }
};
