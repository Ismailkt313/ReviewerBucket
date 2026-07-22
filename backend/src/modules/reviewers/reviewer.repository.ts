import { ReviewerModel } from "./reviewer.model";
import { RatingModel } from "../ratings/rating.model";
import { ExperienceModel } from "../experiences/experience.model";
import type { IReviewer } from "./reviewer.types";

export class ReviewerRepository {
  // Public listing: only APPROVED reviewers
  async findAll(): Promise<IReviewer[]> {
    return await ReviewerModel.find({ status: "APPROVED" })
      .sort({ name: 1 })
      .lean<IReviewer[]>();
  }

  // Public stats listing: only APPROVED reviewers
  async findAllWithStats(): Promise<any[]> {
    // 1. Fetch all APPROVED reviewers sorted by name with projections
    const reviewers = await ReviewerModel.find({ status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .sort({ name: 1 })
      .lean();

    // 2. Perform stats aggregation queries in parallel
    const [ratingStats, experienceStats] = await Promise.all([
      RatingModel.aggregate([
        {
          $group: {
            _id: "$reviewerId",
            averageRating: { $avg: "$value" },
            ratingCount: { $sum: 1 }
          }
        }
      ]),
      ExperienceModel.aggregate([
        {
          $group: {
            _id: "$reviewerId",
            experienceCount: { $sum: 1 },
            lastUpdated: { $max: "$createdAt" }
          }
        }
      ])
    ]);

    // 3. Build lookup maps for O(1) matching
    const ratingMap = new Map(ratingStats.map((r) => [r._id.toString(), r]));
    const experienceMap = new Map(experienceStats.map((e) => [e._id.toString(), e]));

    // 4. Assemble the decorated reviewers array
    return reviewers.map((r) => {
      const rIdStr = r._id.toString();
      const rStat = ratingMap.get(rIdStr);
      const eStat = experienceMap.get(rIdStr);

      return {
        ...r,
        stats: {
          averageRating: rStat ? Number(rStat.averageRating) : null,
          ratingCount: rStat ? Number(rStat.ratingCount) : 0,
          experienceCount: eStat ? Number(eStat.experienceCount) : 0,
          lastUpdated: eStat ? eStat.lastUpdated : null
        }
      };
    });
  }

  // Public slug lookup: only APPROVED reviewers (supports slug, ObjectId, or code)
  async findBySlug(slugOrId: string): Promise<IReviewer | null> {
    // 1. Check by exact slug match
    let reviewer = await ReviewerModel.findOne({ slug: slugOrId, status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .lean<IReviewer | null>();
    if (reviewer) return reviewer;

    // 2. If slugOrId is a 24-character ObjectId string, check by _id
    if (/^[0-9a-fA-F]{24}$/.test(slugOrId)) {
      reviewer = await ReviewerModel.findOne({ _id: slugOrId, status: "APPROVED" })
        .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
        .lean<IReviewer | null>();
      if (reviewer) return reviewer;
    }

    // 3. Fallback: check by normalized reviewer code
    const normalizedCode = slugOrId.replace(/[\s-]/g, "").toUpperCase();
    return await ReviewerModel.findOne({ code: normalizedCode, status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .lean<IReviewer | null>();
  }

  // Public ID lookup: only APPROVED reviewers
  async findById(id: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ _id: id, status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .lean<IReviewer | null>();
  }

  // Administrative / Moderation lookups: any status
  async findRequestById(id: string): Promise<IReviewer | null> {
    return await ReviewerModel.findById(id).lean<IReviewer | null>();
  }

  async findAllRequests(): Promise<IReviewer[]> {
    return await ReviewerModel.find({ status: { $in: ["PENDING", "REJECTED"] } })
      .sort({ createdAt: -1 })
      .lean<IReviewer[]>();
  }

  async findByCodeAndStatusList(code: string, statusList: string[]): Promise<IReviewer | null> {
    const normalizedCode = code.replace(/[\s-]/g, "").toUpperCase();
    return await ReviewerModel.findOne({
      code: normalizedCode,
      status: { $in: statusList }
    }).lean<IReviewer | null>();
  }

  async findByNameAndStatusList(name: string, statusList: string[]): Promise<IReviewer | null> {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    return await ReviewerModel.findOne({
      name: { $regex: new RegExp("^" + this.escapeRegExp(normalizedName) + "$", "i") },
      status: { $in: statusList }
    }).lean<IReviewer | null>();
  }

  // Deprecated direct code lookup: checks APPROVED status by default for compatibility
  async findByCode(code: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ code, status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .lean<IReviewer | null>();
  }

  async findByCodeExcluding(code: string, id: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ code, _id: { $ne: id }, status: "APPROVED" })
      .select({ name: 1, code: 1, slug: 1, stacks: 1, status: 1 })
      .lean<IReviewer | null>();
  }

  async create(data: {
    name: string;
    code: string;
    slug: string;
    stacks: string[];
    status?: "PENDING" | "APPROVED" | "REJECTED";
  }): Promise<IReviewer> {
    const doc = await ReviewerModel.create({
      ...data,
      status: data.status || "PENDING"
    });
    return doc.toObject() as unknown as IReviewer;
  }

  async update(
    id: string,
    data: { name: string; code: string; slug: string; stacks: string[]; status?: "PENDING" | "APPROVED" | "REJECTED" }
  ): Promise<IReviewer | null> {
    return await ReviewerModel.findByIdAndUpdate(id, data, { new: true }).lean<IReviewer | null>();
  }

  async updateStatus(id: string, status: "PENDING" | "APPROVED" | "REJECTED"): Promise<IReviewer | null> {
    return await ReviewerModel.findByIdAndUpdate(id, { status }, { new: true }).lean<IReviewer | null>();
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
