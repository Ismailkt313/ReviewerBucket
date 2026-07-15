import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { env } from "../config/env";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  void req;
  void next;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
    return;
  }

  if (env.NODE_ENV === "development") {
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
}
