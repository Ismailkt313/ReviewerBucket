import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error.js";

const adminLoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required." })
    .trim()
    .min(1, "Email is required.")
    .email("Invalid email format."),
  password: z
    .string({ required_error: "Password is required." })
    .min(1, "Password is required.")
});

export function validateAdminLogin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const result = adminLoginSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid input.";
    return next(new AppError(400, firstError));
  }
  req.body = result.data;
  next();
}
