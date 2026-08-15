import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { env } from "../config/env.js";
import { verifyJwt } from "../utils/jwt.js";
import { AdminJwtPayload } from "../modules/admin-auth/admin-auth.types.js";
import { registerCommunityHandlers } from "./community.handler.js";
import { registerExperienceHandlers } from "./experience.handler.js";
import type { ClientToServerEvents as CommunityClientToServer, ServerToClientEvents as CommunityServerToClient } from "../modules/community/community.types.js";
import type { ClientToServerEvents as ExperienceClientToServer, ServerToClientEvents as ExperienceServerToClient } from "../modules/experiences/experience.socket.types.js";

export interface NotificationServerToClient {
  "notification:new": (data: { notification: any }) => void;
  "notification:read:sync": (data: { unreadCount: number }) => void;
  "community:unread:sync": (data: { unreadCount: number }) => void;
  "community:unread:increment": () => void;
  "reviewer:approved": (data: { reviewer: any }) => void;
  "reviewer:updated": (data: { reviewer: any }) => void;
  "reviewer:stats:updated": (data: { reviewerId: string; stats: any }) => void;
}

export interface NotificationClientToServer {
  "community:page:join": () => void;
  "community:page:leave": () => void;
}

export interface PresenceServerToClient {
  "presence:change": (data: { userId: string; isOnline: boolean }) => void;
  "private:unread:sync": (data: { roomId?: string; unreadCount?: number; totalUnreadCount?: number }) => void;
  "private:unread:increment": (data: { roomId: string; messageId?: string }) => void;
  "private:message:new": (message: any) => void;
  "broadcast:new": (broadcast: any) => void;
  "broadcast:unread:increment": (data?: { broadcastId?: string }) => void;
  "broadcast:unread:sync": (data: { unreadCount: number }) => void;
}

export interface PresenceClientToServer {
  "presence:check": (payload: { userId: string }, callback?: (res: { isOnline: boolean }) => void) => void;
  "private:room:read": (payload: { roomId: string }) => void;
  "broadcast:read": () => void;
  "join:private-room": (payload: { roomId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  "leave:private-room": (payload: { roomId: string }) => void;
  "private:message:send": (payload: { roomId: string; content: string; replyTo?: string }, callback?: (res: { success: boolean; message?: any; error?: string }) => void) => void;
}

export interface CombinedClientToServer extends CommunityClientToServer, ExperienceClientToServer, NotificationClientToServer, PresenceClientToServer {}
export interface CombinedServerToClient extends CommunityServerToClient, ExperienceServerToClient, NotificationServerToClient, PresenceServerToClient {}

export type RealtimeSocketServer = SocketIOServer<CombinedClientToServer, CombinedServerToClient>;

let io: RealtimeSocketServer | null = null;

export function initSocket(httpServer: HTTPServer): RealtimeSocketServer {
  io = new SocketIOServer<CombinedClientToServer, CombinedServerToClient>(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    let role = "USER";
    let isAdmin = false;

    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (token) {
      const cleanToken = typeof token === "string" && token.startsWith("Bearer ") ? token.substring(7).trim() : String(token).trim();
      try {
        const payload = verifyJwt<AdminJwtPayload>(cleanToken, env.JWT_SECRET);
        if (payload && payload.role === "ADMIN") {
          isAdmin = true;
          role = "ADMIN";
        }
      } catch {
        // Fall through to anonymous check if token verification fails
      }
    }

    const rawClientId =
      socket.handshake.auth?.anonymousClientId ||
      socket.handshake.headers?.["x-anonymous-client-id"] ||
      socket.handshake.query?.anonymousClientId;

    const clientId = typeof rawClientId === "string" && rawClientId.trim().length > 0 && rawClientId.trim() !== "admin" ? rawClientId.trim() : null;

    if (!isAdmin && !clientId) {
      return next(new Error("Authentication failed"));
    }

    socket.data.user = {
      userId: isAdmin ? "admin" : clientId!,
      anonymousClientId: clientId,
      role,
      isAdmin
    };
    return next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (user) {
      const { userId, role, anonymousClientId, isAdmin } = user;
      if (isAdmin) {
        socket.join("user:admin");
      }
      if (anonymousClientId) {
        socket.join(`user:${anonymousClientId}`);
        socket.join("audience:eligible_users");
      }
      if (userId && userId !== "admin" && userId !== anonymousClientId) {
        socket.join(`user:${userId}`);
      }

      if (role === "USER" || anonymousClientId) {
        socket.broadcast.emit("presence:change", { userId: anonymousClientId || userId, isOnline: true });
      }

      socket.on("presence:check", (payload: { userId: string }, callback?: (res: { isOnline: boolean }) => void) => {
        if (!payload?.userId) {
          callback?.({ isOnline: false });
          return;
        }
        const room = io?.sockets.adapter.rooms.get(`user:${payload.userId}`);
        const isOnline = Boolean(room && room.size > 0);
        callback?.({ isOnline });
      });

      socket.on("join:private-room", async (payload: { roomId: string }, callback?: (res: { success: boolean; error?: string }) => void) => {
        if (!payload?.roomId) {
          callback?.({ success: false, error: "Missing roomId" });
          return;
        }
        try {
          const { PrivateRoomService } = await import("../modules/private-rooms/private-room.service.js");
          const service = new PrivateRoomService();
          if (role === "ADMIN") {
            await service.getAdminRoomById(payload.roomId);
          } else {
            await service.getRoomById(payload.roomId, userId);
          }
          socket.join(`private-room:${payload.roomId}`);
          callback?.({ success: true });
        } catch (err: any) {
          callback?.({ success: false, error: err.message || "Access denied" });
        }
      });

      socket.on("leave:private-room", (payload: { roomId: string }) => {
        if (payload?.roomId) {
          socket.leave(`private-room:${payload.roomId}`);
        }
      });

      socket.on("private:message:send", async (payload: { roomId: string; content: string; replyTo?: string }, callback?: (res: { success: boolean; message?: any; error?: string }) => void) => {
        if (!payload?.roomId || !payload?.content) {
          callback?.({ success: false, error: "Invalid message payload" });
          return;
        }
        try {
          const { PrivateMessageService } = await import("../modules/private-messages/private-message.service.js");
          const messageService = new PrivateMessageService();
          let message: any;
          if (role === "ADMIN") {
            message = await messageService.sendAdminMessage(payload.roomId, payload.content, payload.replyTo);
          } else {
            message = await messageService.sendMessage(payload.roomId, userId, payload.content, payload.replyTo);
          }
          callback?.({ success: true, message });
        } catch (err: any) {
          callback?.({ success: false, error: err.message || "Failed to send message" });
        }
      });

      socket.on("private:room:read", async (payload: { roomId: string }) => {
        if (payload?.roomId) {
          try {
            const { PrivateRoomService } = await import("../modules/private-rooms/private-room.service.js");
            const service = new PrivateRoomService();
            await service.markRoomAsRead(payload.roomId, userId);
            if (role === "USER") {
              const unreadData = await service.getUserUnreadCounts(userId);
              socket.emit("private:unread:sync", {
                roomId: payload.roomId,
                unreadCount: 0,
                totalUnreadCount: unreadData.totalUnreadCount
              });
            } else {
              socket.emit("private:unread:sync", {
                roomId: payload.roomId,
                unreadCount: 0
              });
            }
          } catch {
            // ignore
          }
        }
      });

      socket.on("broadcast:read", async () => {
        if (role === "USER" && userId) {
          try {
            const { BroadcastReadStateModel } = await import("../modules/broadcasts/broadcast-read-state.model.js");
            await BroadcastReadStateModel.findOneAndUpdate(
              { clientId: userId },
              { lastReadAt: new Date() },
              { upsert: true, new: true }
            );
            socket.emit("broadcast:unread:sync", { unreadCount: 0 });
          } catch {
            // ignore
          }
        }
      });

      socket.on("disconnect", () => {
        if (role === "USER") {
          const remaining = io?.sockets.adapter.rooms.get(`user:${userId}`)?.size || 0;
          if (remaining === 0) {
            socket.broadcast.emit("presence:change", { userId, isOnline: false });
          }
        }
      });
    }

    registerCommunityHandlers(io!, socket);
    registerExperienceHandlers(io!, socket);
  });

  return io;
}

export function getIO(): RealtimeSocketServer | null {
  return io;
}
