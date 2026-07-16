import { ReviewerModel } from "./reviewer.model";
import type { IReviewer } from "./reviewer.types";

export class ReviewerRepository {
  async findAll(): Promise<IReviewer[]> {
    return await ReviewerModel.find().lean<IReviewer[]>();
  }

  async findBySlug(slug: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ slug }).lean<IReviewer | null>();
  }

  async findById(id: string): Promise<IReviewer | null> {
    return await ReviewerModel.findById(id).lean<IReviewer | null>();
  }

  async findByCode(code: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ code }).lean<IReviewer | null>();
  }

  async findByCodeExcluding(code: string, id: string): Promise<IReviewer | null> {
    return await ReviewerModel.findOne({ code, _id: { $ne: id } }).lean<IReviewer | null>();
  }

  async create(data: { name: string; code: string; slug: string; stacks: string[] }): Promise<IReviewer> {
    const doc = await ReviewerModel.create(data);
    return doc.toObject() as unknown as IReviewer;
  }

  async update(id: string, data: { name: string; code: string; slug: string; stacks: string[] }): Promise<IReviewer | null> {
    return await ReviewerModel.findByIdAndUpdate(id, data, { new: true }).lean<IReviewer | null>();
  }
}

