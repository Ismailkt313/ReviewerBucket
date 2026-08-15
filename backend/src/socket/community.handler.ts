import { Socket } from "socket.io";
import { RealtimeSocketServer } from "./socket.js";
import { CommunityService } from "../modules/community/community.service.js";
import { env } from "../config/env.js";
import { CommunityBroadcaster } from "./community.broadcaster.js";
import type { InternalCommunityMessage, PublicCommunityMessage } from "../modules/community/community.types.js";

const communityService = new CommunityService();

function toPublicMessage(msg: InternalCommunityMessage, isMine: boolean): PublicCommunityMessage {
  return {
    id: msg.id,
    _id: msg._id,
    content: msg.content,
    message: msg.content,
    color: msg.color,
    replyTo: msg.replyTo ? {
      id: msg.replyTo.id,
      _id: msg.replyTo._id,
      content: msg.replyTo.content,
      message: msg.replyTo.content,
      color: msg.replyTo.color
    } : null,
    createdAt: msg.createdAt,
    isMine,
    // Include sender identity for non-own messages so the client can initiate private rooms.
    // Own messages omit this field since messaging yourself is prevented by the backend.
    ...(isMine ? {} : { anonymousClientId: msg.anonymousClientId })
  };
}

function createRateLimiter() {
  const timestamps: number[] = [];
  return function isRateLimited(): boolean {
    const now = Date.now();
    const windowStart = now - env.COMMUNITY_RATE_LIMIT_WINDOW_MS;
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }
    if (timestamps.length >= env.COMMUNITY_RATE_LIMIT_MAX_MESSAGES) {
      return true;
    }
    timestamps.push(now);
    return false;
  };
}

export function registerCommunityHandlers(io: RealtimeSocketServer, socket: Socket): void {
  const anonymousClientId: string = socket.handshake.auth.anonymousClientId;
  const isRateLimited = createRateLimiter();

  // Broadcast the updated count to all OTHER already-connected clients
  socket.broadcast.emit("community:online-count", { count: io.sockets.sockets.size });

  // Send the current count directly to the newly connected socket.
  // Use setImmediate/nextTick so the client's listener has time to attach
  // (the socket.io "connect" event fires synchronously before React registers handlers).
  setTimeout(() => {
    if (socket.connected) {
      socket.emit("community:online-count", { count: io.sockets.sockets.size });
    }
  }, 100);

  socket.on("community:history:request", async () => {
    try {
      const { messages: internalMessages, hasMore } = await communityService.getRecentHistory(30);
      const messages = internalMessages.map((msg) =>
        toPublicMessage(msg, msg.anonymousClientId === anonymousClientId)
      );
      socket.emit("community:history", { messages, hasMore });
    } catch {
      socket.emit("community:error", { message: "Failed to load history" });
    }
  });

  socket.on("community:history:more", async (payload: { beforeId: string }) => {
    try {
      if (!payload?.beforeId) return;
      const { messages: internalMessages, hasMore } = await communityService.getRecentHistory(30, payload.beforeId);
      const messages = internalMessages.map((msg) =>
        toPublicMessage(msg, msg.anonymousClientId === anonymousClientId)
      );
      socket.emit("community:history:more:response", { messages, hasMore });
    } catch {
      socket.emit("community:error", { message: "Failed to load older messages" });
    }
  });

  // Allow any client to request the current online count on demand.
  // This handles the case where the socket is already connected (shared singleton)
  // and the Community page mounts without triggering a new socket connection.
  socket.on("community:online-count:request", () => {
    socket.emit("community:online-count", { count: io.sockets.sockets.size });
  });

  socket.on("community:page:join", async () => {
    socket.join("community:active");
    try {
      const { CommunityReadStateModel } = await import("../modules/community/community-read-state.model.js");
      await CommunityReadStateModel.findOneAndUpdate(
        { clientId: anonymousClientId },
        { lastReadAt: new Date() },
        { upsert: true }
      );
      // Sync unread count to 0 for all connections of this user
      for (const [_, s] of io.sockets.sockets.entries()) {
        if (s.handshake.auth?.anonymousClientId === anonymousClientId) {
          s.emit("community:unread:sync", { unreadCount: 0 });
        }
      }
    } catch (err) {
      console.error("Failed to update community read state on join:", err);
    }
  });

  socket.on("community:page:leave", () => {
    socket.leave("community:active");
  });

  socket.on("community:message:send", async (
    payload: { content?: string; message?: string; color: string; replyTo?: string | null },
    ack: (response: { success: boolean; message?: string; messageId?: string }) => void
  ) => {
    if (typeof ack !== "function") {
      return;
    }
    if (isRateLimited()) {
      ack({ success: false, message: "Too many messages. Please wait a moment." });
      return;
    }
    const messageText = payload?.message || payload?.content;
    const result = await communityService.submitMessage(
      messageText,
      payload?.color,
      payload?.replyTo,
      anonymousClientId
    );
    if (!result.success) {
      ack({ success: false, message: result.error });
      return;
    }

    const publicMsg = toPublicMessage(result.message, false);
    CommunityBroadcaster.broadcastMessage(publicMsg, socket.id);
    ack({ success: true, messageId: result.message.id });

    // Broadcast unread badge increments in real time to connected users outside the community page
    for (const [_, s] of io.sockets.sockets.entries()) {
      const isViewingCommunity = s.rooms.has("community:active");
      const socketClientId = s.handshake.auth?.anonymousClientId;
      if (socketClientId && socketClientId !== anonymousClientId && !isViewingCommunity) {
        s.emit("community:unread:increment");
      }
    }
  });

  socket.on("disconnect", () => {
    const count = Math.max(0, io.sockets.sockets.size);
    io.emit("community:online-count", { count });
  });
}

