import { rateLimit } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import type { Options } from "express-rate-limit";

/**
 * Rate limiter for rating creation/update submissions.
 * Limits each IP to 5 rating submissions per 5-minute window.
 */
export const ratingSubmissionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 5, // Maximum 5 rating submission requests per window per IP
  standardHeaders: "draft-7", // draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: 429,
  message: {
    success: false,
    message: "Too many rating submission requests from this IP, please try again after 5 minutes."
  },
  handler: (_req: Request, res: Response, _next: NextFunction, options: Options) => {
    res.status(options.statusCode).json(options.message);
  }
});
