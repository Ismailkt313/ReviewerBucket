import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { verifyJwt } from "../../utils/jwt.js";
import { AdminJwtPayload } from "./admin-auth.types.js";

export function requireAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new AppError(401, "Authentication required"));
  }

  if (!authHeader.startsWith("Bearer ")) {
    return next(new AppError(401, "Invalid authorization header format"));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError(401, "Invalid authorization header format"));
  }

  try {
    const payload = verifyJwt<AdminJwtPayload>(token, env.JWT_SECRET);

    if (!payload || typeof payload !== "object") {
      return next(new AppError(401, "Invalid token payload"));
    }

    if (payload.role !== "ADMIN") {
      return next(new AppError(403, "Forbidden: Admin access required"));
    }

    const adminContext = {
      sub: payload.sub || "admin",
      role: payload.role
    };

    req.admin = adminContext;
    req.user = adminContext;

    next();
  } catch (error) {
    next(error);
  }
}
