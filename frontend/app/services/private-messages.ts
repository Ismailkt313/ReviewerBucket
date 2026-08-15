import { getApiUrl } from "../utils/api";
import { getAnonymousClientId } from "../utils/anonymous-id";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface IPrivateMessage {
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

export interface GetMessagesResult {
  messages: IPrivateMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

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

export async function getMessages(
  roomId: string,
  limit = 50,
  cursor?: string
): Promise<GetMessagesResult> {
  const clientId = getClientId();

  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(
    getApiUrl(`/api/private-rooms/${roomId}/messages?${params.toString()}`),
    { headers: { "x-anonymous-client-id": clientId } }
  );

  if (res.status === 403) {
    throw new Error("You are not a participant in this conversation.");
  }
  if (res.status === 404) {
    throw new Error("This private conversation is no longer available.");
  }
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load messages."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as GetMessagesResult;
}

export async function sendMessage(
  roomId: string,
  content: string,
  replyTo?: string | null
): Promise<IPrivateMessage> {
  const clientId = getClientId();

  const res = await fetch(
    getApiUrl(`/api/private-rooms/${roomId}/messages`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-anonymous-client-id": clientId
      },
      body: JSON.stringify({ content, replyTo })
    }
  );

  if (res.status === 403) {
    throw new Error("You are not a participant in this conversation.");
  }
  if (res.status === 404) {
    throw new Error("This private conversation is no longer available.");
  }
  if (!res.ok) {
    throw new Error(await parseError(res, "Failed to send message. Please try again."));
  }

  const json = await res.json();
  if (!json?.data) throw new Error("Unexpected response from server.");
  return json.data as IPrivateMessage;
}
