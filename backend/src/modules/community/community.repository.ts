import { CommunityMessageModel } from "./community-message.model";
import type { InternalCommunityMessage } from "./community.types";

export class CommunityRepository {
  async create(content: string, anonymousClientId?: string): Promise<InternalCommunityMessage> {
    const doc = await CommunityMessageModel.create({ content, anonymousClientId });
    const obj = doc.toObject();
    return {
      id: obj._id.toString(),
      content: obj.content,
      createdAt: obj.createdAt.toISOString(),
      anonymousClientId: obj.anonymousClientId
    };
  }

  async getRecentMessages(limit: number): Promise<InternalCommunityMessage[]> {
    const docs = await CommunityMessageModel.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const reversed = docs.reverse();

    return reversed.map((doc) => ({
      id: doc._id.toString(),
      content: doc.content,
      createdAt: doc.createdAt.toISOString(),
      anonymousClientId: doc.anonymousClientId
    }));
  }
}
