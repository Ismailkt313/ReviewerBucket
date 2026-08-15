import { Types } from "mongoose";
import { PrivateRoomRepository } from "./private-room.repository.js";
import { AppError } from "../../errors/app-error.js";
import { CommunityMessageModel } from "../community/community-message.model.js";
import { CommunityReadStateModel } from "../community/community-read-state.model.js";
import { NotificationModel } from "../notifications/notification.model.js";
import { RatingModel } from "../ratings/rating.model.js";
import { ExperienceModel } from "../experiences/experience.model.js";
import { PrivateRoomModel } from "./private-room.model.js";
import { PrivateRoomReadStateModel } from "./private-room-read-state.model.js";
import { PrivateMessageModel } from "../private-messages/private-message.model.js";
import { AdminRoomLabelModel } from "./admin-room-label.model.js";
import { getIO } from "../../socket/socket.js";
import type { IPrivateRoom } from "./private-room.types.js";

export class PrivateRoomService {
  private repository = new PrivateRoomRepository();

  async validateTargetUserExists(targetUserId: string): Promise<boolean> {
    const [
      hasCommunityMsg,
      hasCommunityRead,
      hasNotification,
      hasRating,
      hasExperience,
      hasPrivateRoom
    ] = await Promise.all([
      CommunityMessageModel.exists({ anonymousClientId: targetUserId }),
      CommunityReadStateModel.exists({ clientId: targetUserId }),
      NotificationModel.exists({ clientId: targetUserId }),
      RatingModel.exists({ anonymousClientId: targetUserId }),
      ExperienceModel.exists({ anonymousClientId: targetUserId }),
      PrivateRoomModel.exists({ participants: targetUserId })
    ]);

    return !!(
      hasCommunityMsg ||
      hasCommunityRead ||
      hasNotification ||
      hasRating ||
      hasExperience ||
      hasPrivateRoom
    );
  }

  async getOrCreateRoom(currentUserId: string, targetUserId: string): Promise<IPrivateRoom> {
    const trimmedCurrent = currentUserId.trim();
    const trimmedTarget = targetUserId.trim();

    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    if (!trimmedTarget) {
      throw new AppError(400, "Missing target user ID");
    }

    if (trimmedCurrent === trimmedTarget) {
      throw new AppError(400, "Cannot create a private room with yourself");
    }

    // Validate target anonymous user exists unless target is fixed admin participant
    if (trimmedTarget !== "admin") {
      const targetExists = await this.validateTargetUserExists(trimmedTarget);
      if (!targetExists) {
        throw new AppError(404, "Target anonymous user does not exist");
      }
    }

    // Check if a room already exists between the two participants
    const existingRoom = await this.repository.findBetweenParticipants(trimmedCurrent, trimmedTarget);
    if (existingRoom) {
      return existingRoom;
    }

    // Attempt to create a new room, handling concurrent creation race condition
    try {
      return await this.repository.create(trimmedCurrent, trimmedTarget);
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err && err.code === 11000) {
        const raceExisting = await this.repository.findBetweenParticipants(trimmedCurrent, trimmedTarget);
        if (raceExisting) {
          return raceExisting;
        }
      }
      throw error;
    }
  }

  async createOrGetDeveloperRoom(currentUserId: string): Promise<IPrivateRoom> {
    const trimmedCurrent = currentUserId.trim();
    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }
    return this.getOrCreateRoom(trimmedCurrent, "admin");
  }

  formatAnonymousDisplayId(id: string): string {
    if (id === "admin") return "admin";
    if (id.startsWith("user#")) return id;
    return `user#${id}`;
  }

  async setAdminRoomLabel(roomId: string, rawLabel: string): Promise<string | null> {
    const trimmed = rawLabel.trim();

    // Ensure room exists and admin is a participant
    await this.getAdminRoomById(roomId);

    if (!trimmed) {
      await AdminRoomLabelModel.deleteOne({ roomId: new Types.ObjectId(roomId) });
      return null;
    }

    if (trimmed.length > 100) {
      throw new AppError(400, "Label cannot exceed 100 characters");
    }

    const doc = await AdminRoomLabelModel.findOneAndUpdate(
      { roomId: new Types.ObjectId(roomId) },
      { label: trimmed, adminId: "admin" },
      { upsert: true, new: true }
    );

    return doc.label;
  }

  async getAdminDeveloperRooms(
    limit = 50,
    beforeUpdatedAt?: string
  ): Promise<IPrivateRoom[]> {
    const rooms = await this.repository.findByParticipant("admin", limit, beforeUpdatedAt);
    if (rooms.length === 0) {
      return [];
    }

    const roomObjectIds = rooms.map((r) => new Types.ObjectId(r.id));
    const [readStates, labels, lastMessages] = await Promise.all([
      PrivateRoomReadStateModel.find({
        clientId: "admin",
        roomId: { $in: roomObjectIds }
      }).lean(),
      AdminRoomLabelModel.find({
        roomId: { $in: roomObjectIds }
      }).lean(),
      PrivateMessageModel.aggregate([
        { $match: { roomId: { $in: roomObjectIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$roomId",
            messageId: { $first: "$_id" },
            senderId: { $first: "$senderId" },
            content: { $first: "$content" },
            createdAt: { $first: "$createdAt" }
          }
        }
      ])
    ]);

    const readStateMap = new Map<string, Date>();
    for (const rs of readStates) {
      readStateMap.set(rs.roomId.toString(), rs.lastReadAt);
    }

    const labelMap = new Map<string, string>();
    for (const l of labels) {
      labelMap.set(l.roomId.toString(), l.label);
    }

    const lastMessageMap = new Map<string, { id: string; senderId: string; content: string; createdAt: string }>();
    for (const lm of lastMessages) {
      lastMessageMap.set(lm._id.toString(), {
        id: lm.messageId.toString(),
        senderId: lm.senderId,
        content: lm.content,
        createdAt: lm.createdAt.toISOString()
      });
    }

    await Promise.all(
      rooms.map(async (room) => {
        const lastReadAt = readStateMap.get(room.id);
        const filter: Record<string, unknown> = {
          roomId: new Types.ObjectId(room.id),
          senderId: { $ne: "admin" }
        };
        if (lastReadAt) {
          filter.createdAt = { $gt: lastReadAt };
        }
        room.unreadCount = await PrivateMessageModel.countDocuments(filter);
        room.displayParticipants = [
          this.formatAnonymousDisplayId(room.participants[0]),
          this.formatAnonymousDisplayId(room.participants[1])
        ];
        const anonPart = room.participants.find((p) => p !== "admin");
        if (anonPart) {
          room.anonymousDisplayId = this.formatAnonymousDisplayId(anonPart);
        }
        room.adminLabel = labelMap.get(room.id);
        room.lastMessage = lastMessageMap.get(room.id) || null;
      })
    );

    return rooms;
  }

  async getAdminRoomById(roomId: string): Promise<IPrivateRoom> {
    const room = await this.repository.findById(roomId);
    if (!room) {
      throw new AppError(404, "Private room not found");
    }

    const isMember = room.participants.includes("admin");
    if (!isMember) {
      throw new AppError(403, "Access denied: Not a developer room");
    }

    const [lastRead, labelDoc, latestMessage] = await Promise.all([
      PrivateRoomReadStateModel.findOne({
        roomId: new Types.ObjectId(roomId),
        clientId: "admin"
      }).lean(),
      AdminRoomLabelModel.findOne({
        roomId: new Types.ObjectId(roomId)
      }).lean(),
      PrivateMessageModel.findOne({
        roomId: new Types.ObjectId(roomId)
      }).sort({ createdAt: -1 }).lean()
    ]);

    const filter: Record<string, unknown> = {
      roomId: new Types.ObjectId(roomId),
      senderId: { $ne: "admin" }
    };
    if (lastRead) {
      filter.createdAt = { $gt: lastRead.lastReadAt };
    }
    room.unreadCount = await PrivateMessageModel.countDocuments(filter);
    room.displayParticipants = [
      this.formatAnonymousDisplayId(room.participants[0]),
      this.formatAnonymousDisplayId(room.participants[1])
    ];
    const anonPart = room.participants.find((p) => p !== "admin");
    if (anonPart) {
      room.anonymousDisplayId = this.formatAnonymousDisplayId(anonPart);
    }
    if (labelDoc) {
      room.adminLabel = labelDoc.label;
    }
    if (latestMessage) {
      room.lastMessage = {
        id: latestMessage._id.toString(),
        senderId: latestMessage.senderId,
        content: latestMessage.content,
        createdAt: latestMessage.createdAt.toISOString()
      };
    } else {
      room.lastMessage = null;
    }

    return room;
  }

  async getUserRooms(
    currentUserId: string,
    limit = 50,
    beforeUpdatedAt?: string
  ): Promise<IPrivateRoom[]> {
    const trimmedCurrent = currentUserId.trim();
    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    const rooms = await this.repository.findByParticipant(trimmedCurrent, limit, beforeUpdatedAt);
    if (rooms.length === 0) {
      return [];
    }

    const roomObjectIds = rooms.map((r) => new Types.ObjectId(r.id));
    const [readStates, lastMessages] = await Promise.all([
      PrivateRoomReadStateModel.find({
        clientId: trimmedCurrent,
        roomId: { $in: roomObjectIds }
      }).lean(),
      PrivateMessageModel.aggregate([
        { $match: { roomId: { $in: roomObjectIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$roomId",
            messageId: { $first: "$_id" },
            senderId: { $first: "$senderId" },
            content: { $first: "$content" },
            createdAt: { $first: "$createdAt" }
          }
        }
      ])
    ]);

    const readStateMap = new Map<string, Date>();
    for (const rs of readStates) {
      readStateMap.set(rs.roomId.toString(), rs.lastReadAt);
    }

    const lastMessageMap = new Map<string, { id: string; senderId: string; content: string; createdAt: string }>();
    for (const lm of lastMessages) {
      lastMessageMap.set(lm._id.toString(), {
        id: lm.messageId.toString(),
        senderId: lm.senderId,
        content: lm.content,
        createdAt: lm.createdAt.toISOString()
      });
    }

    await Promise.all(
      rooms.map(async (room) => {
        const lastReadAt = readStateMap.get(room.id);
        const filter: Record<string, unknown> = {
          roomId: new Types.ObjectId(room.id),
          senderId: { $ne: trimmedCurrent }
        };
        if (lastReadAt) {
          filter.createdAt = { $gt: lastReadAt };
        }
        room.unreadCount = await PrivateMessageModel.countDocuments(filter);
        room.lastMessage = lastMessageMap.get(room.id) || null;
      })
    );

    return rooms;
  }

  async getRoomById(roomId: string, currentUserId: string): Promise<IPrivateRoom> {
    const trimmedCurrent = currentUserId.trim();
    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    const room = await this.repository.findById(roomId);
    if (!room) {
      throw new AppError(404, "Private room not found");
    }

    const isMember = room.participants.includes(trimmedCurrent);
    if (!isMember) {
      throw new AppError(403, "Access denied: You are not a participant in this room");
    }

    const [lastRead, latestMessage] = await Promise.all([
      PrivateRoomReadStateModel.findOne({
        roomId: new Types.ObjectId(roomId),
        clientId: trimmedCurrent
      }).lean(),
      PrivateMessageModel.findOne({
        roomId: new Types.ObjectId(roomId)
      }).sort({ createdAt: -1 }).lean()
    ]);

    const filter: Record<string, unknown> = {
      roomId: new Types.ObjectId(roomId),
      senderId: { $ne: trimmedCurrent }
    };
    if (lastRead) {
      filter.createdAt = { $gt: lastRead.lastReadAt };
    }
    room.unreadCount = await PrivateMessageModel.countDocuments(filter);
    if (latestMessage) {
      room.lastMessage = {
        id: latestMessage._id.toString(),
        senderId: latestMessage.senderId,
        content: latestMessage.content,
        createdAt: latestMessage.createdAt.toISOString()
      };
    } else {
      room.lastMessage = null;
    }

    return room;
  }

  async markRoomAsRead(roomId: string, currentUserId: string): Promise<void> {
    const trimmedCurrent = currentUserId.trim();
    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    if (trimmedCurrent === "admin") {
      await this.getAdminRoomById(roomId);
    } else {
      await this.getRoomById(roomId, trimmedCurrent);
    }

    await PrivateRoomReadStateModel.findOneAndUpdate(
      { roomId: new Types.ObjectId(roomId), clientId: trimmedCurrent },
      { lastReadAt: new Date() },
      { upsert: true }
    );

    // Emit real-time unread sync to all sockets of this user
    try {
      const io = getIO();
      if (io) {
        if (trimmedCurrent === "admin") {
          io.to("user:admin").emit("private:unread:sync", { roomId, unreadCount: 0 });
        } else {
          const unreadData = await this.getUserUnreadCounts(trimmedCurrent);
          io.to(`user:${trimmedCurrent}`).emit("private:unread:sync", {
            roomId,
            unreadCount: 0,
            totalUnreadCount: unreadData.totalUnreadCount
          });
        }
      }
    } catch {
      // ignore
    }
  }

  async getUserUnreadCounts(
    currentUserId: string
  ): Promise<{ totalUnreadCount: number; rooms: Record<string, number> }> {
    const trimmedCurrent = currentUserId.trim();
    if (!trimmedCurrent) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    const rooms = await this.repository.findByParticipant(trimmedCurrent, 200);
    if (rooms.length === 0) {
      return { totalUnreadCount: 0, rooms: {} };
    }

    const roomObjectIds = rooms.map((r) => new Types.ObjectId(r.id));
    const readStates = await PrivateRoomReadStateModel.find({
      clientId: trimmedCurrent,
      roomId: { $in: roomObjectIds }
    }).lean();

    const readStateMap = new Map<string, Date>();
    for (const rs of readStates) {
      readStateMap.set(rs.roomId.toString(), rs.lastReadAt);
    }

    const roomCounts: Record<string, number> = {};
    let totalUnreadCount = 0;

    await Promise.all(
      rooms.map(async (room) => {
        const lastReadAt = readStateMap.get(room.id);
        const filter: Record<string, unknown> = {
          roomId: new Types.ObjectId(room.id),
          senderId: { $ne: trimmedCurrent }
        };
        if (lastReadAt) {
          filter.createdAt = { $gt: lastReadAt };
        }
        const count = await PrivateMessageModel.countDocuments(filter);
        roomCounts[room.id] = count;
        totalUnreadCount += count;
      })
    );

    return { totalUnreadCount, rooms: roomCounts };
  }
}

