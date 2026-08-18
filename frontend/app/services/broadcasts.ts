import { getApiUrl } from "../utils/api";
import { getAnonymousClientId } from "../utils/anonymous-id";
import { adminFetch } from "./admin-auth";

export type BroadcastDeliveryMode = "ANNOUNCEMENT" | "DIRECT_MESSAGE";

export type BroadcastCategory =
  | "FEATURE_UPDATE"
  | "COMMUNITY"
  | "IMPORTANT"
  | "SYSTEM"
  | "PRODUCT_UPDATE";

export type BroadcastPriority = "NORMAL" | "IMPORTANT" | "HIGH" | "CRITICAL";

export type BroadcastAudience = "ALL_USERS";

export interface IPublicBroadcast {
  id: string;
  _id?: string;
  title?: string;
  content: string;
  type: "SYSTEM_BROADCAST";
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience: "ALL_USERS";
  deliveryMode?: BroadcastDeliveryMode;
  isPinned?: boolean;
  senderName: string;
  secondaryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminBroadcast {
  id: string;
  _id?: string;
  adminId?: string;
  title?: string;
  content: string;
  type: "SYSTEM_BROADCAST";
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience: "ALL_USERS";
  deliveryMode?: BroadcastDeliveryMode;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch public broadcast announcements for eligible users.
 */
export async function getUserBroadcasts(limit = 50): Promise<IPublicBroadcast[]> {
  const clientId = getAnonymousClientId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (clientId) {
    headers["x-anonymous-client-id"] = clientId;
  }

  const res = await fetch(getApiUrl(`/api/broadcasts?limit=${limit}`), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load official announcements");
  }

  const data = await res.json();
  return data.broadcasts || [];
}

/**
 * Fetch broadcast announcements history for authenticated admin.
 */
export async function getAdminBroadcasts(limit = 50): Promise<IAdminBroadcast[]> {
  const res = await adminFetch(getApiUrl(`/api/admin/broadcasts?limit=${limit}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load broadcast history");
  }

  const data = await res.json();
  return data.broadcasts || [];
}

/**
 * Fetch single broadcast details for authenticated admin.
 */
export async function getAdminBroadcastById(id: string): Promise<IAdminBroadcast> {
  const res = await adminFetch(getApiUrl(`/api/admin/broadcasts/${id}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load broadcast");
  }

  const data = await res.json();
  return data.broadcast;
}

export interface CreateAdminBroadcastPayload {
  title?: string;
  content: string;
  category?: BroadcastCategory;
  priority?: BroadcastPriority;
  audience?: BroadcastAudience;
  deliveryMode?: BroadcastDeliveryMode;
}

/**
 * Create a new official broadcast announcement or mass direct message (Admin only).
 */
export async function createAdminBroadcast(
  payloadOrContent: string | CreateAdminBroadcastPayload,
  legacyDeliveryMode: BroadcastDeliveryMode = "ANNOUNCEMENT"
): Promise<IAdminBroadcast> {
  let body: Record<string, unknown>;
  if (typeof payloadOrContent === "string") {
    body = { content: payloadOrContent, deliveryMode: legacyDeliveryMode };
  } else {
    body = {
      title: payloadOrContent.title?.trim() || undefined,
      content: payloadOrContent.content.trim(),
      category: payloadOrContent.category || "COMMUNITY",
      priority: payloadOrContent.priority || "NORMAL",
      audience: "ALL_USERS",
      deliveryMode: payloadOrContent.deliveryMode || "ANNOUNCEMENT",
    };
  }

  const res = await adminFetch(getApiUrl("/api/admin/broadcasts"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to send broadcast");
  }

  const data = await res.json();
  return data.broadcast;
}

/**
 * Fetch unread broadcast announcements count for current anonymous client.
 */
export async function getBroadcastUnreadCount(): Promise<number> {
  const clientId = getAnonymousClientId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (clientId) {
    headers["x-anonymous-client-id"] = clientId;
  }

  try {
    const res = await fetch(getApiUrl("/api/broadcasts/unread"), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) return 0;
    const json = await res.json();
    return json.data?.unreadCount || 0;
  } catch {
    return 0;
  }
}

/**
 * Mark broadcast announcements as read for current anonymous client.
 */
export async function markBroadcastsAsRead(): Promise<void> {
  const clientId = getAnonymousClientId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (clientId) {
    headers["x-anonymous-client-id"] = clientId;
  }

  try {
    await fetch(getApiUrl("/api/broadcasts/read"), {
      method: "PUT",
      headers,
      cache: "no-store",
    });
  } catch {
    // Non-blocking catch
  }
}
