import { Types, FilterQuery } from "mongoose";
import { PrivateRoomModel } from "./private-room.model.js";
import type { IPrivateRoom, IPrivateRoomDoc } from "./private-room.types.js";

export class PrivateRoomRepository {
  private formatRoom(doc: {
    _id: Types.ObjectId | string;
    participants: string[];
    createdAt: Date | string;
    updatedAt: Date | string;
  }): IPrivateRoom {
    const id = doc._id.toString();
    return {
      id,
      _id: id,
      participants: [doc.participants[0], doc.participants[1]],
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
    };
  }

  async create(user1: string, user2: string): Promise<IPrivateRoom> {
    const sorted = [user1, user2].sort() as [string, string];
    const doc = await PrivateRoomModel.create({
      participants: sorted
    });
    return this.formatRoom(doc.toObject());
  }

  async findBetweenParticipants(user1: string, user2: string): Promise<IPrivateRoom | null> {
    const sorted = [user1, user2].sort() as [string, string];
    const doc = await PrivateRoomModel.findOne({
      "participants.0": sorted[0],
      "participants.1": sorted[1]
    }).lean<IPrivateRoomDoc | null>();

    if (!doc) return null;
    return this.formatRoom(doc);
  }

  async findById(roomId: string): Promise<IPrivateRoom | null> {
    if (!Types.ObjectId.isValid(roomId)) {
      return null;
    }
    const doc = await PrivateRoomModel.findById(roomId).lean<IPrivateRoomDoc | null>();
    if (!doc) return null;
    return this.formatRoom(doc);
  }

  async findByParticipant(
    participantId: string,
    limit = 50,
    beforeUpdatedAt?: string
  ): Promise<IPrivateRoom[]> {
    const query: FilterQuery<IPrivateRoomDoc> = {
      participants: participantId
    };

    if (beforeUpdatedAt) {
      const date = new Date(beforeUpdatedAt);
      if (!isNaN(date.getTime())) {
        query.updatedAt = { $lt: date };
      }
    }

    const docs = await PrivateRoomModel.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .lean<IPrivateRoomDoc[]>();

    return docs.map((doc) => this.formatRoom(doc));
  }

  async findByParticipantPaginated(
    participantId: string,
    page = 1,
    limit = 20,
    beforeUpdatedAt?: string,
    matchingRoomIds?: Types.ObjectId[]
  ): Promise<{
    rooms: IPrivateRoom[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    hasPrev: boolean;
    hasNext: boolean;
  }> {
    const query: FilterQuery<IPrivateRoomDoc> = {
      participants: participantId
    };

    if (matchingRoomIds !== undefined) {
      if (matchingRoomIds.length === 0) {
        return {
          rooms: [],
          total: 0,
          page: Math.max(1, page),
          limit,
          totalPages: 1,
          hasMore: false,
          hasPrev: page > 1,
          hasNext: false
        };
      }
      query._id = { $in: matchingRoomIds };
    }

    if (beforeUpdatedAt) {
      const date = new Date(beforeUpdatedAt);
      if (!isNaN(date.getTime())) {
        query.updatedAt = { $lt: date };
      }
    }

    const total = await PrivateRoomModel.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.max(1, page);
    const skip = (currentPage - 1) * limit;

    const docs = await PrivateRoomModel.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<IPrivateRoomDoc[]>();

    const rooms = docs.map((doc) => this.formatRoom(doc));

    return {
      rooms,
      total,
      page: currentPage,
      limit,
      totalPages,
      hasMore: currentPage < totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages
    };
  }

  async isParticipant(roomId: string, participantId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(roomId)) {
      return false;
    }
    const exists = await PrivateRoomModel.exists({
      _id: new Types.ObjectId(roomId),
      participants: participantId
    });
    return !!exists;
  }
}
