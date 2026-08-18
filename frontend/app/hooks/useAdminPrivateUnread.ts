"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../utils/socket";
import {
  getAdminPrivateUnreadCounts,
  markAdminPrivateRoomAsRead,
  AdminPrivateUnreadData,
} from "../services/admin-chat";
import { getAdminToken } from "../utils/admin-token";

export function useAdminPrivateUnread() {
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<Record<string, number>>({});

  const fetchAdminUnread = useCallback(async () => {
    try {
      const token = getAdminToken();
      if (!token) return;

      const data: AdminPrivateUnreadData = await getAdminPrivateUnreadCounts();
      setTotalUnreadCount(data.totalUnreadCount || 0);
      setRoomUnreadCounts(data.rooms || {});
    } catch {
      // Non-blocking: silence errors for background unread check
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
      const token = getAdminToken();
      if (!token) return;

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("private:room:read", { roomId });
      }
      await markAdminPrivateRoomAsRead(roomId);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;

    let isCancelled = false;
    getAdminPrivateUnreadCounts()
      .then((data) => {
        if (isCancelled) return;
        setTotalUnreadCount(data.totalUnreadCount || 0);
        setRoomUnreadCounts(data.rooms || {});
      })
      .catch(() => {});

    const socket = getSocket();

    const handleConnect = () => {
      fetchAdminUnread();
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
          [data.roomId!]: (prev[data.roomId!] || 0) + 1,
        }));
      }
      setTotalUnreadCount((count) => count + 1);
    };

    const handleSync = (data?: {
      roomId?: string;
      unreadCount?: number;
      totalUnreadCount?: number;
      rooms?: Record<string, number>;
    }) => {
      if (data) {
        if (typeof data.totalUnreadCount === "number") {
          setTotalUnreadCount(data.totalUnreadCount);
        }
        if (data.rooms) {
          setRoomUnreadCounts(data.rooms);
        } else if (data.roomId && typeof data.unreadCount === "number") {
          setRoomUnreadCounts((prev) => ({
            ...prev,
            [data.roomId!]: data.unreadCount!,
          }));
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAdminUnread();
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
      isCancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      socket.off("connect", handleConnect);
      socket.off("private:unread:increment", handleIncrement);
      socket.off("private:unread:sync", handleSync);
    };
  }, [fetchAdminUnread]);

  return {
    totalUnreadCount,
    unreadCount: totalUnreadCount,
    roomUnreadCounts,
    markRoomRead,
    refetch: fetchAdminUnread,
  };
}
