import { Types, FilterQuery } from "mongoose";
import { PrivateMessageModel } from "./private-message.model.js";
import type {
  IPrivateMessage,
  IPrivateMessageDoc,
  GetPrivateMessagesResult
} from "./private-message.types.js";

export function serializeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}_${id}`).toString("base64");
}

export function deserializeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [dateStr, id] = decoded.split("_");
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && id && Types.ObjectId.isValid(id)) {
      return { createdAt: date, id };
    }
    return null;
  } catch {
    return null;
  }
}

export class PrivateMessageRepository {
  private formatMessage(doc: any): IPrivateMessage {
    const id = doc._id.toString();
    let replyTo = null;
    if (doc.replyTo && typeof doc.replyTo === "object") {
      replyTo = {
        id: doc.replyTo._id ? doc.replyTo._id.toString() : String(doc.replyTo.id),
        _id: doc.replyTo._id ? doc.replyTo._id.toString() : String(doc.replyTo.id),
        senderId: doc.replyTo.senderId || "",
        content: doc.replyTo.content || ""
      };
    } else if (doc.replyTo) {
      replyTo = {
        id: doc.replyTo.toString(),
        _id: doc.replyTo.toString(),
        senderId: "",
        content: ""
      };
    }

    return {
      id,
      _id: id,
      roomId: doc.roomId.toString(),
      senderId: doc.senderId,
      content: doc.content,
      replyTo,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
    };
  }

  async create(roomId: string, senderId: string, content: string, replyToId?: string | null): Promise<IPrivateMessage> {
    let replyToObjectId: Types.ObjectId | undefined = undefined;
    if (replyToId && Types.ObjectId.isValid(replyToId)) {
      replyToObjectId = new Types.ObjectId(replyToId);
    }

    const doc = await PrivateMessageModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId,
      content,
      replyTo: replyToObjectId
    });
    const populated = await doc.populate("replyTo");
    return this.formatMessage(populated.toObject());
  }

  async findByRoom(
    roomId: string,
    limit = 50,
    cursor?: string
  ): Promise<GetPrivateMessagesResult> {
    const query: FilterQuery<IPrivateMessageDoc> = {
      roomId: new Types.ObjectId(roomId)
    };

    if (cursor) {
      const parsed = deserializeCursor(cursor);
      if (parsed) {
        query.$or = [
          { createdAt: { $lt: parsed.createdAt } },
          {
            createdAt: parsed.createdAt,
            _id: { $lt: new Types.ObjectId(parsed.id) }
          }
        ];
      }
    }

    const docs = await PrivateMessageModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("replyTo")
      .lean();

    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    let nextCursor: string | undefined;
    if (hasMore && resultDocs.length > 0) {
      const oldestInBatch = resultDocs[resultDocs.length - 1];
      const createdAt =
        oldestInBatch.createdAt instanceof Date
          ? oldestInBatch.createdAt
          : new Date(oldestInBatch.createdAt);
      nextCursor = serializeCursor(createdAt, oldestInBatch._id.toString());
    }

    // Return messages in chronological order (oldest -> newest) for chat rendering
    const chronologicalDocs = [...resultDocs].reverse();

    return {
      messages: chronologicalDocs.map((doc) => this.formatMessage(doc)),
      hasMore,
      nextCursor
    };
  }

  async findById(id: string): Promise<IPrivateMessage | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await PrivateMessageModel.findById(id).populate("replyTo").lean();
    if (!doc) return null;
    return this.formatMessage(doc);
  }
}
