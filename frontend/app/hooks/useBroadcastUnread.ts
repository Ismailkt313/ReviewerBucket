"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../utils/socket";
import { getAnonymousClientId } from "../utils/anonymous-id";
import { getApiUrl } from "../utils/api";

export function useBroadcastUnread() {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchBroadcastUnread = useCallback(async () => {
    try {
      const clientId = getAnonymousClientId();
      if (!clientId) return;

      const res = await fetch(getApiUrl("/api/broadcasts/unread"), {
        headers: {
          "x-anonymous-client-id": clientId,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          setUnreadCount(json.data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.warn("[Broadcast] Could not fetch unread broadcast count:", err);
    }
  }, []);

  const markBroadcastRead = useCallback(async () => {
    // Optimistic UI update
    setUnreadCount(0);

    try {
      const clientId = getAnonymousClientId();
      if (!clientId) return;

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("broadcast:read");
      }

      await fetch(getApiUrl("/api/broadcasts/read"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-anonymous-client-id": clientId,
        },
      });
    } catch (err) {
      console.error("[Broadcast] Failed to mark broadcasts as read:", err);
    }
  }, []);

  useEffect(() => {
    fetchBroadcastUnread();

    const socket = getSocket();
    const processedBroadcastIds = new Set<string>();

    const handleConnect = () => {
      fetchBroadcastUnread();
    };

    const handleIncrement = (data?: { broadcastId?: string; id?: string }) => {
      const bId = data?.broadcastId || data?.id;
      if (bId) {
        if (processedBroadcastIds.has(bId)) return;
        processedBroadcastIds.add(bId);
        if (processedBroadcastIds.size > 200) {
          processedBroadcastIds.clear();
        }
      }
      setUnreadCount((count) => count + 1);
    };

    const handleSync = (data?: { unreadCount?: number }) => {
      const newCount = data && typeof data.unreadCount === "number" ? data.unreadCount : 0;
      setUnreadCount(newCount);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchBroadcastUnread();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on("connect", handleConnect);
    }

    // Only listen to increment (with id deduplication) and sync events
    socket.on("broadcast:unread:increment", handleIncrement);
    socket.on("broadcast:unread:sync", handleSync);

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      socket.off("connect", handleConnect);
      socket.off("broadcast:unread:increment", handleIncrement);
      socket.off("broadcast:unread:sync", handleSync);
    };
  }, [fetchBroadcastUnread]);

  return {
    unreadCount,
    markBroadcastRead,
    refetch: fetchBroadcastUnread,
  };
}
