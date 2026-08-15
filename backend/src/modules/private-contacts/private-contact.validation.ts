import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error.js";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const renameContactSchema = z.object({
  nickname: z
    .string()
    .max(50, "Nickname cannot exceed 50 characters")
    .nullable()
    .optional()
});

const getContactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export function getAnonymousClientId(req: Request): string {
  const clientId =
    req.headers["x-anonymous-client-id"] ||
    req.query.anonymousClientId ||
    req.body?.anonymousClientId;

  return typeof clientId === "string" ? clientId.trim() : "";
}

export function validateContactId(req: Request, _res: Response, next: NextFunction): void {
  const { contactId } = req.params;
  if (!contactId || typeof contactId !== "string" || !UUID_V4_REGEX.test(contactId.trim())) {
    return next(new AppError(400, "Invalid contact ID format"));
  }
  next();
}

export function validateRenameContact(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = renameContactSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid rename payload";
    return next(new AppError(400, firstError));
  }

  req.body = {
    nickname: result.data.nickname ?? null
  };

  next();
}

export function validateGetContactsQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const clientId = getAnonymousClientId(req);
  if (!clientId) {
    return next(new AppError(400, "Missing anonymous client ID"));
  }

  const result = getContactsQuerySchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError(400, "Invalid query parameters"));
  }

  req.query = result.data as unknown as Request["query"];
  next();
}
