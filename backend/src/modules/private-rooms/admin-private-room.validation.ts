import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error.js";

const adminSendPrivateMessageSchema = z.object({
  content: z
    .string({ required_error: "Message content is required" })
    .refine((val) => val.trim().length > 0, {
      message: "Message content cannot be empty"
    })
    .pipe(z.string().max(2000, "Message content cannot exceed 2000 characters"))
});

const adminGetQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export function validateAdminSendMessage(req: Request, _res: Response, next: NextFunction): void {
  const result = adminSendPrivateMessageSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid message payload";
    return next(new AppError(400, firstError));
  }

  req.body = {
    content: result.data.content
  };

  next();
}

export function validateAdminGetQuery(req: Request, _res: Response, next: NextFunction): void {
  const result = adminGetQuerySchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError(400, "Invalid query parameters"));
  }

  req.query = result.data as unknown as Request["query"];
  next();
}
