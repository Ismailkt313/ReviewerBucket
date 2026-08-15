import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { AppError } from "../../errors/app-error.js";

const createPrivateRoomSchema = z
  .object({
    targetUserId: z.string().uuid("Invalid target user ID").optional(),
    targetAnonymousClientId: z.string().uuid("Invalid target user ID").optional()
  })
  .refine((data) => data.targetUserId || data.targetAnonymousClientId, {
    message: "Target user ID is required."
  });

const getPrivateRoomsQuerySchema = z.object({
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

export function validateAnonymousClientId(req: Request, _res: Response, next: NextFunction): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }
  next();
}

export function validateCreatePrivateRoom(req: Request, _res: Response, next: NextFunction): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = createPrivateRoomSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid private room request payload";
    return next(new AppError(400, firstError));
  }

  const targetUserId = result.data.targetUserId || result.data.targetAnonymousClientId;
  req.body = {
    targetUserId
  };

  next();
}

export function validateRoomId(req: Request, _res: Response, next: NextFunction): void {
  const { roomId } = req.params;
  if (!roomId || !Types.ObjectId.isValid(roomId)) {
    return next(new AppError(400, "Invalid room ID format"));
  }
  next();
}

export function validateGetPrivateRoomsQuery(req: Request, _res: Response, next: NextFunction): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = getPrivateRoomsQuerySchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError(400, "Invalid query parameters"));
  }

  req.query = result.data as unknown as Request["query"];
  next();
}
