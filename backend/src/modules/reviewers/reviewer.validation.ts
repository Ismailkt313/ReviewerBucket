import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../../errors/app-error";

const slugSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/)
});

const ALLOWED_STACKS = [
  "MERN",
  "Data Science",
  "AI/ML",
  "Media",
  "Flutter",
  "Golang",
  "Python",
  "QA Team",
  "Game Development (Unity)",
  "Game Development (Unreal)"
] as const;

const createReviewerSchema = z.object({
  name: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, " "))
    .pipe(z.string().max(100, "Name must be at most 100 characters."))
    .optional()
    .or(z.literal("")),
  code: z
    .string()
    .trim()
    .transform((val) => val.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().min(1, "Code is required.").max(20, "Code must be at most 20 characters.")),
  stacks: z
    .array(z.enum(ALLOWED_STACKS, { errorMap: () => ({ message: "Invalid stack selection." }) }))
    .min(1, "At least one stack is required.")
    .max(10, "Maximum 10 stacks allowed.")
    .refine((arr) => new Set(arr).size === arr.length, { message: "Duplicate stacks are not allowed." })
});

export function validateSlug(req: Request, _res: Response, next: NextFunction): void {
  const result = slugSchema.safeParse(req.params);
  if (!result.success) {
    return next(new AppError(400, "Invalid reviewer slug format"));
  }
  req.params.slug = result.data.slug;
  next();
}

export function validateCreateReviewer(req: Request, _res: Response, next: NextFunction): void {
  const result = createReviewerSchema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || "Invalid input.";
    return next(new AppError(400, firstError));
  }
  req.body = result.data;
  next();
}
