import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { AppError } from "../../errors/app-error.js";

const createBroadcastSchema = z.object({
  content: z
    .string({ required_error: "Broadcast content is required." })
    .trim()
    .min(1, "Broadcast content cannot be empty.")
    .max(2000, "Broadcast content cannot exceed 2000 characters."),
  deliveryMode: z.enum(["ANNOUNCEMENT", "DIRECT_MESSAGE"]).default("ANNOUNCEMENT").optional()
});

const getBroadcastsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export function validateCreateBroadcast(req: Request, _res: Response, next: NextFunction): void {
  const result = createBroadcastSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid broadcast request payload";
    return next(new AppError(400, firstError));
  }

  req.body.content = result.data.content;
  req.body.deliveryMode = result.data.deliveryMode || "ANNOUNCEMENT";
  next();
}

export function validateBroadcastId(req: Request, _res: Response, next: NextFunction): void {
  const { id } = req.params;
  if (!id || !Types.ObjectId.isValid(id)) {
    return next(new AppError(400, "Invalid broadcast ID format"));
  }
  next();
}

export function validateGetBroadcastsQuery(req: Request, _res: Response, next: NextFunction): void {
  const result = getBroadcastsQuerySchema.safeParse(req.query);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid query parameters";
    return next(new AppError(400, firstError));
  }

  req.query.limit = String(result.data.limit);
  next();
}
