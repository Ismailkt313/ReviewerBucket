import { BroadcastModel } from "./broadcast.model.js";
import type { IBroadcastDoc, BroadcastDeliveryMode } from "./broadcast.types.js";

export class BroadcastRepository {
  async create(
    adminId: string,
    content: string,
    audience: "ALL_USERS" = "ALL_USERS",
    deliveryMode: BroadcastDeliveryMode = "ANNOUNCEMENT"
  ): Promise<IBroadcastDoc> {
    const broadcast = new BroadcastModel({
      adminId,
      content,
      type: "SYSTEM_BROADCAST",
      audience,
      deliveryMode
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
