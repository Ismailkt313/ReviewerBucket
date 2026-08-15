"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../utils/socket";
import { getAdminPrivateRooms, AdminPrivateRoom } from "../services/admin-chat";
import { getAdminToken } from "../utils/admin-token";

export function useAdminPrivateUnread() {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchAdminUnread = useCallback(async () => {
    try {
      const token = getAdminToken();
      if (!token) return;

      const rooms = await getAdminPrivateRooms();
      const total = rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0);
      setUnreadCount(total);
    } catch {
      // Non-blocking: silence errors for background unread check
    }
  }, []);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;

    fetchAdminUnread();

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
      setUnreadCount((count) => count + 1);
    };


    const handleSync = (data?: { unreadCount?: number }) => {
      if (data && typeof data.unreadCount === "number") {
        fetchAdminUnread();
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
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      socket.off("connect", handleConnect);
      socket.off("private:unread:increment", handleIncrement);
      socket.off("private:unread:sync", handleSync);
    };
  }, [fetchAdminUnread]);

  return {
    unreadCount,
    refetch: fetchAdminUnread
  };
}
