import { ReviewerRepository } from "./reviewer.repository";
import type { IReviewer } from "./reviewer.types";
import { AppError } from "../../errors/app-error";

export class ReviewerService {
  private reviewerRepository = new ReviewerRepository();

  async getAllReviewers(): Promise<IReviewer[]> {
    return await this.reviewerRepository.findAll();
  }

  async getReviewerBySlug(slug: string): Promise<IReviewer> {
    const reviewer = await this.reviewerRepository.findBySlug(slug);
    if (!reviewer) {
      throw new AppError(404, "Reviewer not found");
    }
    return reviewer;
  }

  async createReviewer(input: {
    name: string;
    code: string;
    stacks: string[];
  }): Promise<IReviewer> {
    const normalizedCode = input.code.replace(/[\s-]/g, "").toUpperCase();
    const slug = normalizedCode.toLowerCase();
    const normalizedName = input.name.trim().replace(/\s+/g, " ");

    const existing = await this.reviewerRepository.findByCode(normalizedCode);
    if (existing) {
      throw new AppError(409, `Reviewer code "${normalizedCode}" already exists.`);
    }

    try {
      return await this.reviewerRepository.create({
        name: normalizedName,
        code: normalizedCode,
        slug,
        stacks: input.stacks.map((s) => s.trim()).filter(Boolean)
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new AppError(409, `Reviewer code "${normalizedCode}" already exists.`);
      }
      throw error;
    }
  }

  async updateReviewer(
    id: string,
    input: {
      name: string;
      code: string;
      stacks: string[];
    }
  ): Promise<IReviewer> {
    const normalizedCode = input.code.replace(/[\s-]/g, "").toUpperCase();
    const slug = normalizedCode.toLowerCase();
    const normalizedName = input.name.trim().replace(/\s+/g, " ");

    const existing = await this.reviewerRepository.findByCodeExcluding(normalizedCode, id);
    if (existing) {
      throw new AppError(409, `Reviewer code "${normalizedCode}" already exists.`);
    }

    try {
      const updated = await this.reviewerRepository.update(id, {
        name: normalizedName,
        code: normalizedCode,
        slug,
        stacks: input.stacks.map((s) => s.trim()).filter(Boolean)
      });
      if (!updated) {
        throw new AppError(404, "Reviewer not found");
      }
      return updated;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new AppError(409, `Reviewer code "${normalizedCode}" already exists.`);
      }
      throw error;
    }
  }
}
