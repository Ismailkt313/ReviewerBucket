import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { AppError } from "../../errors/app-error.js";

const sendPrivateMessageSchema = z.object({
  content: z
    .string({ required_error: "Message content is required" })
    .refine((val) => val.trim().length > 0, {
      message: "Message content cannot be empty"
    })
    .pipe(z.string().max(2000, "Message content cannot exceed 2000 characters"))
});

const getPrivateMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export function getAnonymousClientId(req: Request): string {
  const clientId =
    req.headers["x-anonymous-client-id"] ||
    req.query.anonymousClientId ||
    req.body?.anonymousClientId;

  return typeof clientId === "string" ? clientId.trim() : "";
}

export function validateRoomId(req: Request, _res: Response, next: NextFunction): void {
  const { roomId } = req.params;
  if (!roomId || !Types.ObjectId.isValid(roomId)) {
    return next(new AppError(400, "Invalid room ID format"));
  }
  next();
}

export function validateSendPrivateMessage(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = sendPrivateMessageSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid message payload";
    return next(new AppError(400, firstError));
  }

  req.body = {
    content: result.data.content
  };

  next();
}

export function validateGetPrivateMessagesQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = getPrivateMessagesQuerySchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError(400, "Invalid query parameters"));
  }

  req.query = result.data as unknown as Request["query"];
  next();
}
