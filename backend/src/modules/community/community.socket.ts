import { Server as SocketIOServer, Namespace } from "socket.io";
import { CommunityService } from "./community.service";
import { env } from "../../config/env";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InternalCommunityMessage,
  PublicCommunityMessage
} from "./community.types";

type CommunityNamespace = Namespace<ClientToServerEvents, ServerToClientEvents>;

const communityService = new CommunityService();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPublicMessage(msg: InternalCommunityMessage, isMine: boolean): PublicCommunityMessage {
  return {
    id: msg.id,
    content: msg.content,
    createdAt: msg.createdAt,
    isMine
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

function broadcastOnlineCount(nsp: CommunityNamespace): void {
  const count = nsp.sockets.size;
  nsp.emit("community:online-count", { count });
}

export function initCommunitySocket(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
): void {
  const communityNsp = io.of("/community");

  communityNsp.use((socket, next) => {
    const clientId = socket.handshake.auth?.anonymousClientId;
    if (typeof clientId !== "string" || !UUID_V4_REGEX.test(clientId)) {
      next(new Error("Invalid anonymous client ID"));
      return;
    }
    next();
  });

  communityNsp.on("connection", (socket) => {
    const anonymousClientId: string = socket.handshake.auth.anonymousClientId;
    const isRateLimited = createRateLimiter();

    broadcastOnlineCount(communityNsp);

    socket.on("community:history:request", async () => {
      try {
        const internalMessages = await communityService.getRecentHistory();
        const messages = internalMessages.map((msg) =>
          toPublicMessage(msg, msg.anonymousClientId === anonymousClientId)
        );
        socket.emit("community:history", { messages });
      } catch {
        socket.emit("community:error", { message: "Failed to load history" });
      }
    });

    socket.on("community:message:send", async (payload, ack) => {
      if (typeof ack !== "function") {
        return;
      }

      if (isRateLimited()) {
        ack({ success: false, message: "Too many messages. Please wait a moment." });
        return;
      }

      const result = await communityService.submitMessage(payload?.content, anonymousClientId);

      if (!result.success) {
        ack({ success: false, message: result.error });
        return;
      }

      socket.emit("community:message:new", toPublicMessage(result.message, true));
      socket.broadcast.emit("community:message:new", toPublicMessage(result.message, false));
      ack({ success: true, messageId: result.message.id });
    });

    socket.on("disconnect", () => {
      broadcastOnlineCount(communityNsp);
    });
  });
}
