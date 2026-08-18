import { getApiUrl } from "../utils/api";
import { adminFetch } from "./admin-auth";

export interface AdminPrivateRoom {
  id: string;
  _id?: string;
  participants: [string, string];
  anonymousUserId?: string;
  anonymousDisplayId?: string;
  adminLabel?: string;
  lastMessage?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  };
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPrivateMessage {
  id: string;
  _id?: string;
  roomId: string;
  senderId: string;
  content: string;
  replyTo?: {
    id: string;
    senderId: string;
    content: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetAdminMessagesResponse {
  messages: AdminPrivateMessage[];
  hasMore?: boolean;
  nextCursor?: string;
}

/**
 * Format raw user ID or display ID into standard system display string: user#...
 * Example: "11111111-1111-4111-8111-111111111111" -> "user#11111111"
 * Example: "user#223" -> "user#223"
 */
export function formatAdminUserDisplayId(rawId?: string): string {
  if (!rawId) return "user#anonymous";
  if (rawId.startsWith("user#")) return rawId;
  const shortId = rawId.length > 8 ? rawId.substring(0, 8) : rawId;
  return `user#${shortId}`;
}

/**
 * Fetch all developer private room conversations for Admin.
 */
export async function getAdminPrivateRooms(
  limit = 50,
  cursor?: string
): Promise<AdminPrivateRoom[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await adminFetch(getApiUrl(`/api/admin/private-rooms?${params.toString()}`));

  if (!res.ok) {
    let errorMsg = "Failed to load developer conversations.";
    try {
      const json = await res.json();
      if (json.message) errorMsg = json.message;
      if (json.error?.message) errorMsg = json.error.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const json = await res.json();
  if (!Array.isArray(json?.data)) return [];
  return json.data as AdminPrivateRoom[];
}

/**
 * Fetch a specific developer room details by ID for Admin.
 */
export async function getAdminPrivateRoomById(roomId: string): Promise<AdminPrivateRoom> {
  const res = await adminFetch(getApiUrl(`/api/admin/private-rooms/${roomId}`));

  if (res.status === 403) {
    throw new Error("You do not have administrative authorization for this conversation.");
  }
  if (res.status === 404) {
    throw new Error("This developer conversation is no longer available.");
  }
  if (!res.ok) {
    throw new Error("Failed to load conversation details.");
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as AdminPrivateRoom;
}

/**
 * Update private admin-side display label for a developer conversation room.
 */
export async function setAdminRoomLabel(
  roomId: string,
  label: string
): Promise<{ roomId: string; label: string | null }> {
  const res = await adminFetch(getApiUrl(`/api/admin/private-rooms/${roomId}/label`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ label }),
  });

  if (!res.ok) {
    let errorMsg = "Failed to update conversation label.";
    try {
      const json = await res.json();
      if (json.message) errorMsg = json.message;
      if (json.error?.message) errorMsg = json.error.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Fetch messages for a specific developer room.
 */
export async function getAdminPrivateMessages(
  roomId: string,
  limit = 50,
  cursor?: string
): Promise<GetAdminMessagesResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await adminFetch(
    getApiUrl(`/api/admin/private-rooms/${roomId}/messages?${params.toString()}`)
  );

  if (res.status === 403) {
    throw new Error("You are not authorized to view messages in this conversation.");
  }
  if (!res.ok) {
    throw new Error("Failed to load messages.");
  }

  const json = await res.json();
  if (json?.data && Array.isArray(json.data.messages)) {
    return json.data as GetAdminMessagesResponse;
  }
  if (Array.isArray(json?.data)) {
    return { messages: json.data as AdminPrivateMessage[] };
  }
  return { messages: [] };
}

/**
 * Send an admin message to a developer room.
 */
export async function sendAdminPrivateMessage(
  roomId: string,
  content: string,
  replyTo?: string | null
): Promise<AdminPrivateMessage> {
  const res = await adminFetch(getApiUrl(`/api/admin/private-rooms/${roomId}/messages`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, replyTo }),
  });

  if (!res.ok) {
    let errorMsg = "Failed to send message. Please try again.";
    try {
      const json = await res.json();
      if (json.message) errorMsg = json.message;
      if (json.error?.message) errorMsg = json.error.message;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as AdminPrivateMessage;
}

/**
 * Mark a developer room as read for Admin.
 */
export async function markAdminPrivateRoomAsRead(roomId: string): Promise<void> {
  try {
    await adminFetch(getApiUrl(`/api/admin/private-rooms/${roomId}/read`), {
      method: "POST",
    });
  } catch {
    // Non-blocking: background read sync
  }
}

export interface AdminPrivateUnreadData {
  totalUnreadCount: number;
  rooms: Record<string, number>;
}

/**
 * Fetch total and per-room unread counts for Admin.
 */
export async function getAdminPrivateUnreadCounts(): Promise<AdminPrivateUnreadData> {
  try {
    const res = await adminFetch(getApiUrl("/api/admin/private-rooms/unread"));
    if (!res.ok) {
      return { totalUnreadCount: 0, rooms: {} };
    }
    const json = await res.json();
    return json?.data || { totalUnreadCount: 0, rooms: {} };
  } catch {
    return { totalUnreadCount: 0, rooms: {} };
  }
}

