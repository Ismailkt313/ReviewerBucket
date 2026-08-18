import { IPrivateMessage } from "../services/private-messages";
import { IPrivateRoom } from "../services/private-rooms";
import { ContactIdentityResponse } from "../services/private-contacts";

export interface CachedRoomData {
  messages: IPrivateMessage[];
  hasMore: boolean;
  nextCursor?: string;
  roomDetails?: IPrivateRoom;
  contactIdentity?: ContactIdentityResponse;
  lastFetchedAt: number;
  draftText?: string;
  scrollPosition?: number;
}

class PrivateChatCacheManager {
  private roomCache = new Map<string, CachedRoomData>();
  private roomsList: IPrivateRoom[] | null = null;
  private roomsListFetchedAt = 0;
  private listeners = new Set<(roomId?: string) => void>();

  // ── Subscriptions ──────────────────────────────────────────────────────────
  public subscribe(listener: (roomId?: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(roomId?: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(roomId);
      } catch {
        // ignore
      }
    });
  }

  // ── Rooms List ─────────────────────────────────────────────────────────────
  public getRoomsList(): IPrivateRoom[] | null {
    return this.roomsList;
  }

  public setRoomsList(rooms: IPrivateRoom[]) {
    this.roomsList = rooms;
    this.roomsListFetchedAt = Date.now();
    this.notify();
  }

  public updateRoomLastMessage(roomId: string, message: IPrivateMessage, silent = false) {
    if (!this.roomsList) return;
    const index = this.roomsList.findIndex((r) => r.id === roomId);
    if (index === -1) return;

    const existing = this.roomsList[index];
    const updated: IPrivateRoom = {
      ...existing,
      lastMessage: {
        id: message.id || (message as any)._id || message.tempId || `m-${Date.now()}`,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt || new Date().toISOString(),
      },
      updatedAt: message.createdAt || new Date().toISOString(),
    };

    // Move updated room to top of list
    const remaining = this.roomsList.filter((_, i) => i !== index);
    this.roomsList = [updated, ...remaining];
    if (!silent) {
      this.notify(roomId);
    }
  }

  // ── Per-Room Cache ─────────────────────────────────────────────────────────
  public getRoom(roomId: string): CachedRoomData | null {
    return this.roomCache.get(roomId) || null;
  }

  public setRoomData(
    roomId: string,
    data: Partial<CachedRoomData> & { messages?: IPrivateMessage[] },
    silent = false
  ) {
    const prev = this.roomCache.get(roomId) || {
      messages: [],
      hasMore: false,
      lastFetchedAt: 0,
    };

    const next: CachedRoomData = {
      ...prev,
      ...data,
      messages: data.messages !== undefined ? data.messages : prev.messages,
      lastFetchedAt: data.lastFetchedAt || Date.now(),
    };

    this.roomCache.set(roomId, next);
    if (!silent) {
      this.notify(roomId);
    }
    return next;
  }

  public setDraftText(roomId: string, draftText: string) {
    const cached = this.roomCache.get(roomId);
    if (cached) {
      cached.draftText = draftText;
    } else {
      this.roomCache.set(roomId, {
        messages: [],
        hasMore: false,
        lastFetchedAt: 0,
        draftText,
      });
    }
  }

  public getDraftText(roomId: string): string {
    return this.roomCache.get(roomId)?.draftText || "";
  }

  public appendOptimisticMessage(roomId: string, optimisticMsg: IPrivateMessage) {
    const cached = this.roomCache.get(roomId) || {
      messages: [],
      hasMore: false,
      lastFetchedAt: Date.now(),
    };

    // Ensure no duplicates
    const idToMatch = optimisticMsg.id || optimisticMsg.tempId;
    const exists = cached.messages.some(
      (m) => m.id === idToMatch || m.tempId === idToMatch
    );

    if (!exists) {
      cached.messages = [...cached.messages, optimisticMsg];
      this.roomCache.set(roomId, cached);
      this.updateRoomLastMessage(roomId, optimisticMsg, true);
      this.notify(roomId);
    }
  }

  public resolveOptimisticMessage(
    roomId: string,
    tempId: string,
    serverMsg: IPrivateMessage
  ) {
    const cached = this.roomCache.get(roomId);
    if (!cached) return;

    let found = false;
    const updatedMessages = cached.messages.map((m) => {
      if (m.tempId === tempId || m.id === tempId) {
        found = true;
        return {
          ...serverMsg,
          status: "sent" as const,
          tempId: undefined,
        };
      }
      return m;
    });

    if (found) {
      // Deduplicate if socket event already pushed this server message
      const seen = new Set<string>();
      const deduplicated: IPrivateMessage[] = [];
      for (const m of updatedMessages) {
        const id = m.id || (m as any)._id;
        if (!seen.has(id)) {
          seen.add(id);
          deduplicated.push(m);
        }
      }
      cached.messages = deduplicated;
      this.roomCache.set(roomId, cached);
      this.updateRoomLastMessage(roomId, serverMsg, true);
      this.notify(roomId);
    }
  }

  public markOptimisticMessageFailed(roomId: string, tempId: string) {
    const cached = this.roomCache.get(roomId);
    if (!cached) return;

    cached.messages = cached.messages.map((m) => {
      if (m.tempId === tempId || m.id === tempId) {
        return {
          ...m,
          status: "failed" as const,
        };
      }
      return m;
    });

    this.roomCache.set(roomId, cached);
    this.notify(roomId);
  }

  public removeOptimisticMessage(roomId: string, tempId: string) {
    const cached = this.roomCache.get(roomId);
    if (!cached) return;

    cached.messages = cached.messages.filter(
      (m) => m.tempId !== tempId && m.id !== tempId
    );
    this.roomCache.set(roomId, cached);
    this.notify(roomId);
  }

  public handleIncomingSocketMessage(roomId: string, incomingMsg: IPrivateMessage) {
    const cached = this.roomCache.get(roomId);
    const incomingId = incomingMsg.id || (incomingMsg as any)._id;

    if (cached) {
      // Check if this message already exists (either by id or matching optimistic content)
      const existingIndex = cached.messages.findIndex(
        (m) =>
          m.id === incomingId ||
          (m as any)._id === incomingId ||
          (m.status === "sending" &&
            m.content === incomingMsg.content &&
            m.senderId === incomingMsg.senderId)
      );

      if (existingIndex !== -1) {
        // Replace optimistic or existing with incoming message
        cached.messages[existingIndex] = {
          ...incomingMsg,
          status: "sent",
        };
      } else {
        cached.messages = [...cached.messages, { ...incomingMsg, status: "sent" }];
      }

      this.roomCache.set(roomId, cached);
    }

    this.updateRoomLastMessage(roomId, incomingMsg, true);
    this.notify(roomId);
  }
}

export const privateChatCache = new PrivateChatCacheManager();
