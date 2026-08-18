"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../utils/socket";
import { getAnonymousClientId } from "../utils/anonymous-id";
import { getApiUrl } from "../utils/api";

export interface PrivateUnreadData {
  totalUnreadCount: number;
  rooms: Record<string, number>;
}

export function usePrivateUnread() {
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<Record<string, number>>({});

  const fetchPrivateUnread = useCallback(async () => {
    try {
      const clientId = getAnonymousClientId();
      if (!clientId) return;

      const res = await fetch(getApiUrl("/api/private-rooms/unread"), {
        headers: {
          "x-anonymous-client-id": clientId
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          setTotalUnreadCount(json.data.totalUnreadCount || 0);
          setRoomUnreadCounts(json.data.rooms || {});
        }
      }
    } catch (err) {
      console.warn("[PrivateChats] Could not fetch private unread counts:", err);
    }
  }, []);

  const markRoomRead = useCallback(async (roomId: string) => {
    // Optimistic local update
    setRoomUnreadCounts((prev) => {
      const prevRoomCount = prev[roomId] || 0;
      if (prevRoomCount === 0) return prev;
      setTotalUnreadCount((t) => Math.max(0, t - prevRoomCount));
      return { ...prev, [roomId]: 0 };
    });

    try {
      const clientId = getAnonymousClientId();
      if (!clientId) return;

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("private:room:read", { roomId });
      } else {
        await fetch(getApiUrl(`/api/private-rooms/${roomId}/read`), {
          method: "PUT",
          headers: {
            "x-anonymous-client-id": clientId
          }
        });
      }
    } catch (err) {
      console.warn("[PrivateChats] Could not mark room as read:", err);
    }
  }, []);

  useEffect(() => {
    fetchPrivateUnread();

    const socket = getSocket();

    const handleConnect = () => {
      fetchPrivateUnread();
    };

    const processedMessageIds = new Set<string>();

    const handleIncrement = (data?: { roomId?: string; messageId?: string }) => {
      if (data?.messageId) {
        if (processedMessageIds.has(data.messageId)) return;
        processedMessageIds.add(data.messageId);
        if (processedMessageIds.size > 200) {
          processedMessageIds.clear();
        }
      }
      if (data?.roomId) {
        setRoomUnreadCounts((prev) => ({
          ...prev,
          [data.roomId!]: (prev[data.roomId!] || 0) + 1
        }));
      }
      setTotalUnreadCount((count) => count + 1);
    };

    const handleSync = (data?: { roomId?: string; unreadCount?: number; totalUnreadCount?: number }) => {
      if (data) {
        if (typeof data.totalUnreadCount === "number") {
          setTotalUnreadCount(data.totalUnreadCount);
        }
        if (data.roomId && typeof data.unreadCount === "number") {
          setRoomUnreadCounts((prev) => ({
            ...prev,
            [data.roomId!]: data.unreadCount!
          }));
        }
      }
    };


    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchPrivateUnread();
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

    socket.on("private:unread:increment", handleIncrement);
    socket.on("private:unread:sync", handleSync);

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      socket.off("connect", handleConnect);
      socket.off("private:unread:increment", handleIncrement);
      socket.off("private:unread:sync", handleSync);
    };
  }, [fetchPrivateUnread]);

  return {
    totalUnreadCount,
    roomUnreadCounts,
    markRoomRead,
    refetch: fetchPrivateUnread
  };
}
