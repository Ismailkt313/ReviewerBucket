import { ReviewerRepository } from "./reviewer.repository";
import type { IReviewer } from "./reviewer.types";
import { AppError } from "../../errors/app-error";

export class ReviewerService {
  private reviewerRepository = new ReviewerRepository();

  async getAllReviewers(): Promise<IReviewer[]> {
    return await this.reviewerRepository.findAll();
  }

  async getAllReviewersWithStats(): Promise<any[]> {
    return await this.reviewerRepository.findAllWithStats();
  }

  async getReviewerBySlug(slug: string): Promise<IReviewer> {
    const reviewer = await this.reviewerRepository.findBySlug(slug);
    if (!reviewer) {
      throw new AppError(404, "Reviewer not found");
    }
    return reviewer;
  }

  async getReviewerById(id: string): Promise<IReviewer> {
    const reviewer = await this.reviewerRepository.findById(id);
    if (!reviewer) {
      throw new AppError(404, "Reviewer not found");
    }
    return reviewer;
  }

  async createReviewer(input: {
    name: string;
    code: string;
    stacks: string[];
    status?: "PENDING" | "APPROVED" | "REJECTED";
  }): Promise<IReviewer> {
    const normalizedCode = input.code.replace(/[\s-]/g, "").toUpperCase();
    const slug = normalizedCode.toLowerCase();
    const normalizedName = input.name.trim().replace(/\s+/g, " ");

    // Check APPROVED or PENDING duplicates by code or name
    const existingByCode = await this.reviewerRepository.findByCodeAndStatusList(normalizedCode, ["APPROVED", "PENDING"]);
    const existingByName = await this.reviewerRepository.findByNameAndStatusList(normalizedName, ["APPROVED", "PENDING"]);

    if (existingByCode || existingByName) {
      throw new AppError(409, "This reviewer already exists or is awaiting approval.");
    }

    try {
      return await this.reviewerRepository.create({
        name: normalizedName,
        code: normalizedCode,
        slug,
        stacks: input.stacks.map((s) => s.trim()).filter(Boolean),
        status: input.status || "PENDING"
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new AppError(409, "This reviewer already exists or is awaiting approval.");
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

  // Administrative / requests workflows
  async getAllRequests(): Promise<IReviewer[]> {
    return await this.reviewerRepository.findAllRequests();
  }

  async getRequestById(id: string): Promise<IReviewer> {
    const request = await this.reviewerRepository.findRequestById(id);
    if (!request) {
      throw new AppError(404, "Reviewer request not found.");
    }
    return request;
  }

  async approveReviewerRequest(id: string): Promise<IReviewer> {
    const request = await this.getRequestById(id);
    if (request.status !== "PENDING") {
      throw new AppError(400, "This request has already been reviewed.");
    }

    const updated = await this.reviewerRepository.updateStatus(id, "APPROVED");
    if (!updated) {
      throw new AppError(500, "Failed to approve reviewer request.");
    }
    return updated;
  }

  async rejectReviewerRequest(id: string): Promise<IReviewer> {
    const request = await this.getRequestById(id);
    if (request.status !== "PENDING") {
      throw new AppError(400, "This request has already been reviewed.");
    }

    const updated = await this.reviewerRepository.updateStatus(id, "REJECTED");
    if (!updated) {
      throw new AppError(500, "Failed to reject reviewer request.");
    }
    return updated;
  }
}
