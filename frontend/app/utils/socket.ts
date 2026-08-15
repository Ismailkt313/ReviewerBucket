import io, { Socket } from "socket.io-client";
import { getAnonymousClientId } from "./anonymous-id";
import { getAdminToken } from "./admin-token";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    return {} as Socket;
  }
  const anonymousClientId = getAnonymousClientId();
  const token = getAdminToken();

  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    socket = io(socketUrl, {
      transports: ["polling", "websocket"],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      auth: { anonymousClientId, token }
    });
  } else {
    socket.auth = { anonymousClientId, token };
  }
  return socket;
}
