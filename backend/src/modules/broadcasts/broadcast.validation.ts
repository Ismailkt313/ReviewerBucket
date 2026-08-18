import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { AppError } from "../../errors/app-error.js";

const broadcastCategoryEnum = z.enum(
  ["FEATURE_UPDATE", "COMMUNITY", "IMPORTANT", "SYSTEM", "PRODUCT_UPDATE"],
  {
    errorMap: () => ({
      message: "Invalid broadcast category. Must be one of: FEATURE_UPDATE, COMMUNITY, IMPORTANT, SYSTEM, PRODUCT_UPDATE."
    })
  }
);

const broadcastPriorityEnum = z.enum(
  ["NORMAL", "IMPORTANT", "HIGH", "CRITICAL"],
  {
    errorMap: () => ({
      message: "Invalid broadcast priority. Must be one of: NORMAL, IMPORTANT, HIGH, CRITICAL."
    })
  }
);

const broadcastAudienceEnum = z.literal("ALL_USERS", {
  errorMap: () => ({
    message: "Invalid broadcast audience. Only ALL_USERS is supported."
  })
});

const createBroadcastSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200, "Broadcast title cannot exceed 200 characters.")
    .refine((val) => val === undefined || val.length > 0, {
      message: "Broadcast title cannot be empty."
    })
    .optional(),
  content: z
    .string({ required_error: "Broadcast content is required." })
    .trim()
    .min(1, "Broadcast content cannot be empty.")
    .max(2000, "Broadcast content cannot exceed 2000 characters."),
  category: broadcastCategoryEnum.default("COMMUNITY").optional(),
  priority: broadcastPriorityEnum.default("NORMAL").optional(),
  audience: broadcastAudienceEnum.default("ALL_USERS").optional(),
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

  req.body.title = result.data.title || "";
  req.body.content = result.data.content;
  req.body.category = result.data.category || "COMMUNITY";
  req.body.priority = result.data.priority || "NORMAL";
  req.body.audience = "ALL_USERS";
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
