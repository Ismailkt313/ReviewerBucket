import { PrivateMessageRepository } from "./private-message.repository.js";
import { PrivateRoomService } from "../private-rooms/private-room.service.js";
import { PrivateRoomModel } from "../private-rooms/private-room.model.js";
import { CommunityMessageModel } from "../community/community-message.model.js";
import { CommunityReadStateModel } from "../community/community-read-state.model.js";
import { RatingModel } from "../ratings/rating.model.js";
import { ExperienceModel } from "../experiences/experience.model.js";
import { NotificationReadModel } from "../notifications/notification-read.model.js";
import { getIO } from "../../socket/socket.js";
import { AppError } from "../../errors/app-error.js";
import type { IPrivateMessage, GetPrivateMessagesResult } from "./private-message.types.js";

export class PrivateMessageService {
  private repository = new PrivateMessageRepository();
  private privateRoomService = new PrivateRoomService();

  async sendMessage(
    roomId: string,
    currentUserId: string,
    content: string,
    replyToId?: string | null
  ): Promise<IPrivateMessage> {
    const trimmedUser = currentUserId.trim();
    if (!trimmedUser) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Message content cannot be empty");
    }

    if (content.length > 2000) {
      throw new AppError(400, "Message content cannot exceed 2000 characters");
    }

    // Verify room exists and current user is an authorized participant
    const room = await this.privateRoomService.getRoomById(roomId, trimmedUser);

    // Create message with server-derived sender identity
    const message = await this.repository.create(roomId, trimmedUser, content, replyToId);

    // Update sender's read state to current time so own message is marked read
    try {
      await this.privateRoomService.markRoomAsRead(roomId, trimmedUser);
    } catch {
      // ignore
    }

    // Update room updatedAt timestamp to reflect recent activity
    try {
      await PrivateRoomModel.findByIdAndUpdate(roomId, { updatedAt: new Date() });
    } catch {
      // Non-critical background update error ignored
    }

    // Emit real-time message and unread increment to recipient
    const otherParticipant = room.participants.find((p) => p !== trimmedUser);
    if (otherParticipant) {
      try {
        const io = getIO();
        if (io) {
          io.to(`user:${otherParticipant}`).emit("private:message:new", message);
          io.to(`user:${otherParticipant}`).emit("private:unread:increment", { roomId, messageId: message.id });
          io.to(`private-room:${roomId}`).emit("private:message:new", message);
        }
      } catch {
        // ignore
      }
    }

    return message;
  }

  async getMessages(
    roomId: string,
    currentUserId: string,
    limit = 50,
    cursor?: string
  ): Promise<GetPrivateMessagesResult> {
    const trimmedUser = currentUserId.trim();
    if (!trimmedUser) {
      throw new AppError(400, "Missing anonymous client ID");
    }

    // Verify room exists and current user is an authorized participant
    await this.privateRoomService.getRoomById(roomId, trimmedUser);

    // Automatically mark the room as read for the user viewing messages
    try {
      await this.privateRoomService.markRoomAsRead(roomId, trimmedUser);
      const io = getIO();
      if (io) {
        io.to(`user:${trimmedUser}`).emit("private:unread:sync", { roomId, unreadCount: 0 });
      }
    } catch {
      // ignore
    }

    return await this.repository.findByRoom(roomId, limit, cursor);
  }

  async sendAdminMessage(
    roomId: string,
    content: string,
    replyToId?: string | null
  ): Promise<IPrivateMessage> {
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Message content cannot be empty");
    }

    if (content.length > 2000) {
      throw new AppError(400, "Message content cannot exceed 2000 characters");
    }

    // Verify room exists and admin is an authorized participant
    const room = await this.privateRoomService.getAdminRoomById(roomId);

    // Create message with server-derived admin sender identity
    const message = await this.repository.create(roomId, "admin", content, replyToId);

    // Update admin's read state to current time so own message is marked read
    try {
      await this.privateRoomService.markRoomAsRead(roomId, "admin");
    } catch {
      // ignore
    }

    // Update room updatedAt timestamp to reflect recent activity
    try {
      await PrivateRoomModel.findByIdAndUpdate(roomId, { updatedAt: new Date() });
    } catch {
      // Non-critical background update error ignored
    }

    // Emit real-time message and unread increment to anonymous recipient
    const anonymousParticipant = room.participants.find((p) => p !== "admin");
    if (anonymousParticipant) {
      try {
        const io = getIO();
        if (io) {
          io.to(`user:${anonymousParticipant}`).emit("private:message:new", message);
          io.to(`user:${anonymousParticipant}`).emit("private:unread:increment", { roomId, messageId: message.id });
          io.to(`private-room:${roomId}`).emit("private:message:new", message);
        }
      } catch {
        // ignore
      }
    }

    return message;
  }

  async getAdminMessages(
    roomId: string,
    limit = 50,
    cursor?: string
  ): Promise<GetPrivateMessagesResult> {
    // Verify room exists and admin is an authorized participant
    await this.privateRoomService.getAdminRoomById(roomId);

    // Automatically mark room as read for admin viewing messages
    try {
      await this.privateRoomService.markRoomAsRead(roomId, "admin");
      const io = getIO();
      if (io) {
        io.to("user:admin").emit("private:unread:sync", { roomId, unreadCount: 0 });
      }
    } catch {
      // ignore
    }

    return await this.repository.findByRoom(roomId, limit, cursor);
  }

  async getAllActiveAnonymousUserIds(): Promise<string[]> {
    const [
      roomParticipants,
      communitySenders,
      communityReaders,
      raters,
      experiencers,
      notificationReaders
    ] = await Promise.all([
      PrivateRoomModel.distinct("participants"),
      CommunityMessageModel.distinct("anonymousClientId"),
      CommunityReadStateModel.distinct("clientId"),
      RatingModel.distinct("anonymousClientId"),
      ExperienceModel.distinct("anonymousClientId"),
      NotificationReadModel.distinct("clientId").catch(() => [] as string[])
    ]);

    const userSet = new Set<string>();

    const addValidId = (id: any) => {
      if (typeof id === "string") {
        const trimmed = id.trim();
        if (
          trimmed.length > 0 &&
          trimmed !== "admin" &&
          trimmed !== "system" &&
          trimmed !== "broadcast" &&
          trimmed.toLowerCase() !== "reviewer bucket"
        ) {
          userSet.add(trimmed);
        }
      }
    };

    roomParticipants.forEach(addValidId);
    communitySenders.forEach(addValidId);
    communityReaders.forEach(addValidId);
    raters.forEach(addValidId);
    experiencers.forEach(addValidId);
    notificationReaders.forEach(addValidId);

    return Array.from(userSet);
  }

  async sendMassAdminMessage(content: string): Promise<{
    deliveredCount: number;
    userIds: string[];
  }> {
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Message content cannot be empty");
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > 2000) {
      throw new AppError(400, "Message content cannot exceed 2000 characters");
    }

    const userIds = await this.getAllActiveAnonymousUserIds();
    const io = getIO();
    let deliveredCount = 0;

    for (const userId of userIds) {
      try {
        const room = await this.privateRoomService.createOrGetDeveloperRoom(userId);
        const message = await this.repository.create(room.id, "admin", trimmedContent, null);

        // Update room updatedAt
        await PrivateRoomModel.findByIdAndUpdate(room.id, { updatedAt: new Date() });

        // Emit real-time socket events directly to the user's private channel
        if (io) {
          io.to(`user:${userId}`).emit("private:message:new", message);
          io.to(`user:${userId}`).emit("private:unread:increment", { roomId: room.id, messageId: message.id });
          io.to(`private-room:${room.id}`).emit("private:message:new", message);
        }
        deliveredCount++;
      } catch {
        // Continue to next user if single user delivery encounters an issue
      }
    }

    return {
      deliveredCount,
      userIds
    };
  }
}
