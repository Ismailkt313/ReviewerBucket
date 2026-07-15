import { Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response): void {
  void req;
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}
