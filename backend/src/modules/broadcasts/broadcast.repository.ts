import { BroadcastModel } from "./broadcast.model.js";
import type {
  IBroadcastDoc,
  BroadcastType,
  BroadcastCategory,
  BroadcastPriority,
  BroadcastAudience,
  BroadcastDeliveryMode
} from "./broadcast.types.js";

export interface CreateBroadcastRepoParams {
  adminId: string;
  title?: string;
  content: string;
  broadcastType?: BroadcastType;
  posterImageUrl?: string;
  posterMetadata?: Record<string, unknown>;
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience?: BroadcastAudience;
  deliveryMode?: BroadcastDeliveryMode;
}

export class BroadcastRepository {
  async create(params: CreateBroadcastRepoParams): Promise<IBroadcastDoc> {
    const broadcast = new BroadcastModel({
      adminId: params.adminId || "admin",
      title: params.title || "",
      content: params.content,
      type: "SYSTEM_BROADCAST",
      broadcastType: params.broadcastType || "TEXT",
      posterImageUrl: params.posterImageUrl || "",
      posterMetadata: params.posterMetadata,
      category: params.category || "COMMUNITY",
      priority: params.priority || "NORMAL",
      audience: "ALL_USERS",
      deliveryMode: params.deliveryMode || "ANNOUNCEMENT"
    });

    return await broadcast.save();
  }

  async findAll(limit = 50): Promise<IBroadcastDoc[]> {
    return await BroadcastModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findRecentForUsers(limit = 50): Promise<IBroadcastDoc[]> {
    return await BroadcastModel.find({
      audience: "ALL_USERS",
      deliveryMode: "ANNOUNCEMENT"
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string): Promise<IBroadcastDoc | null> {
    return await BroadcastModel.findById(id).exec();
  }
}
