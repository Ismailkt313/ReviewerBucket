import { getApiUrl } from "../utils/api";
import { getAnonymousClientId } from "../utils/anonymous-id";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface IPrivateRoomLastMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface IPrivateRoom {
  unreadCount: number;
  id: string;
  _id?: string;
  participants: [string, string];
  lastMessage?: IPrivateRoomLastMessage | null;
  createdAt: string;
  updatedAt: string;
}

/** Kept for backwards-compat with Module 1 usage in CommunityClient */
export type PrivateRoomData = IPrivateRoom;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientId(): string {
  const clientId = getAnonymousClientId();
  if (!clientId) throw new Error("Anonymous session not found. Please refresh the page.");
  return clientId;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json();
    if (json?.message) return json.message;
    if (json?.error) return json.error;
  } catch {
    // ignore
  }
  return fallback;
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function createOrGetPrivateRoom(
  targetUserId: string
): Promise<IPrivateRoom> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl("/api/private-rooms"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-anonymous-client-id": clientId
    },
    body: JSON.stringify({ targetUserId })
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Could not start private chat. Please try again."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as IPrivateRoom;
}

export async function createOrGetDeveloperRoom(): Promise<IPrivateRoom> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl("/api/private-rooms/developer"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-anonymous-client-id": clientId
    }
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Could not open developer chat. Please try again."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as IPrivateRoom;
}

export async function getMyRooms(
  limit = 50,
  cursor?: string
): Promise<IPrivateRoom[]> {
  const clientId = getClientId();

  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(getApiUrl(`/api/private-rooms?${params.toString()}`), {
    headers: { "x-anonymous-client-id": clientId }
  });

  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load conversations. Please try again."));
  }

  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new Error("Unexpected response from server.");
  return json.data as IPrivateRoom[];
}

export async function getRoomById(roomId: string): Promise<IPrivateRoom> {
  const clientId = getClientId();

  const res = await fetch(getApiUrl(`/api/private-rooms/${roomId}`), {
    headers: { "x-anonymous-client-id": clientId }
  });

  if (res.status === 403) {
    throw new Error("You are not a participant in this conversation.");
  }
  if (res.status === 404) {
    throw new Error("This private conversation is no longer available.");
  }
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load conversation."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as IPrivateRoom;
}
