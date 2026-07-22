import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { env } from "../config/env.js";
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

export interface CombinedClientToServer extends CommunityClientToServer, ExperienceClientToServer, NotificationClientToServer {}
export interface CombinedServerToClient extends CommunityServerToClient, ExperienceServerToClient, NotificationServerToClient {}

export type RealtimeSocketServer = SocketIOServer<CombinedClientToServer, CombinedServerToClient>;

let io: RealtimeSocketServer | null = null;

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function initSocket(httpServer: HTTPServer): RealtimeSocketServer {
  io = new SocketIOServer<CombinedClientToServer, CombinedServerToClient>(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    const clientId = socket.handshake.auth?.anonymousClientId;
    if (typeof clientId !== "string" || !UUID_V4_REGEX.test(clientId)) {
      next(new Error("Invalid anonymous client ID"));
      return;
    }
    next();
  });

  io.on("connection", (socket) => {
    registerCommunityHandlers(io!, socket);
    registerExperienceHandlers(io!, socket);
  });

  return io;
}

export function getIO(): RealtimeSocketServer | null {
  return io;
}
