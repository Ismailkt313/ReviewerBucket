import io, { Socket } from "socket.io-client";
import { getAnonymousClientId } from "./anonymous-id";
import { getAdminToken } from "./admin-token";

let socket: Socket | null = null;
let lastAdminToken: string | null = null;

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
    lastAdminToken = token;
  } else {
    // If admin token changed (e.g. admin logged in), update auth and force reconnect
    // so the server-side handshake middleware picks up the new token and joins user:admin
    if (token !== lastAdminToken) {
      lastAdminToken = token;
      socket.auth = { anonymousClientId, token };
      if (socket.connected) {
        socket.disconnect().connect();
      }
    } else {
      socket.auth = { anonymousClientId, token };
    }
  }
  return socket;
}
