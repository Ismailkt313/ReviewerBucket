"use client";

import React, { useEffect, useCallback, useState, useMemo, JSX } from "react";
import Link from "next/link";
import { Megaphone, Search, User, Wrench, MessageSquare, AlertCircle } from "lucide-react";
import { getMyRooms, IPrivateRoom } from "@/app/services/private-rooms";
import { getMyContacts, ContactIdentityResponse } from "@/app/services/private-contacts";
import { getUserBroadcasts, IPublicBroadcast } from "@/app/services/broadcasts";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import { getSocket } from "@/app/utils/socket";
import { usePrivateUnread } from "../hooks/usePrivateUnread";
import { useBroadcastUnread } from "../hooks/useBroadcastUnread";
import { privateChatCache } from "@/app/utils/private-chat-cache";
import ScrollArea from "@/app/components/ScrollArea";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RoomSkeleton(): JSX.Element {
  return (
    <div className="divide-y divide-white/5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-white/5 rounded w-28" />
            <div className="h-3 bg-white/[0.03] rounded w-44" />
          </div>
          <div className="h-3 bg-white/[0.02] rounded w-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Memoized Single Room Row ─────────────────────────────────────────────────

interface ConversationItemProps {
  room: IPrivateRoom;
  isSelected: boolean;
  displayName: string;
  isDeveloper?: boolean;
  currentUserId?: string;
  unreadCount?: number;
  onClick: (room: IPrivateRoom) => void;
}

const ConversationItem = React.memo(
  function ConversationItem({
    room,
    isSelected,
    displayName,
    isDeveloper,
    currentUserId,
    unreadCount = 0,
    onClick,
  }: ConversationItemProps) {
    const isMine = !!(room.lastMessage && currentUserId && room.lastMessage.senderId === currentUserId);
    const timeString = room.lastMessage?.createdAt || room.updatedAt;

    const handleClick = useCallback(() => {
      onClick(room);
    }, [onClick, room]);

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-full text-left p-4 transition-colors relative block focus-visible:outline-none ${
          isSelected
            ? "bg-white/5"
            : "hover:bg-white/[0.02]"
        }`}
        aria-label={`Open conversation with ${displayName}${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-current={isSelected ? "page" : undefined}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 bg-white/5 border border-white/10 text-neutral-400">
              {isDeveloper ? <Wrench className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>

            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span
                className={`text-xs truncate leading-tight ${
                  isSelected ? "font-medium text-white" : "font-normal text-neutral-200"
                }`}
              >
                {displayName}
              </span>
              {isDeveloper && (
                <span className="border border-white/10 text-neutral-400 bg-transparent text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                  Developer
                </span>
              )}
            </div>
          </div>

          {timeString && (
            <span className="text-[10px] text-neutral-500 font-normal shrink-0 tabular-nums">
              {formatRelativeTime(timeString)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pl-9.5">
          <p className="text-xs text-neutral-500 font-normal truncate leading-relaxed">
            {room.lastMessage?.content ? (
              <>
                {isMine && <span className="font-normal text-neutral-400">You: </span>}
                {room.lastMessage.content}
              </>
            ) : (
              <span className="italic text-neutral-600 text-[11px]">No messages yet</span>
            )}
          </p>

          {unreadCount > 0 && (
            <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.unreadCount === next.unreadCount &&
      prev.displayName === next.displayName &&
      prev.isDeveloper === next.isDeveloper &&
      prev.room.id === next.room.id &&
      prev.room.updatedAt === next.room.updatedAt &&
      prev.room.lastMessage?.id === next.room.lastMessage?.id &&
      prev.room.lastMessage?.content === next.room.lastMessage?.content &&
      prev.room.lastMessage?.createdAt === next.room.lastMessage?.createdAt
    );
  }
);

// ─── Main Component ────────────────────────────────────────────────────────────

export interface ConversationListProps {
  selectedRoomId?: string | null;
  contactsMap?: Record<string, ContactIdentityResponse>;
  onSelect: (room: IPrivateRoom) => void;
  onSelectBroadcast?: () => void;
}

export default function ConversationList({
  selectedRoomId,
  contactsMap = {},
  onSelect,
  onSelectBroadcast,
}: ConversationListProps) {
  const clientId = getAnonymousClientId();
  const { roomUnreadCounts } = usePrivateUnread();
  const { unreadCount: broadcastUnread } = useBroadcastUnread();

  // Initialize from cache synchronously
  const [rooms, setRooms] = useState<IPrivateRoom[]>(
    () => privateChatCache.getRoomsList() || []
  );
  const [latestBroadcast, setLatestBroadcast] = useState<IPublicBroadcast | null>(null);
  const [internalContacts, setInternalContacts] = useState<Record<string, ContactIdentityResponse>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<boolean>(!privateChatCache.getRoomsList());
  const [error, setError] = useState("");

  // Subscribe to cache updates (e.g., when optimistic message sent or socket event received)
  useEffect(() => {
    const unsubscribe = privateChatCache.subscribe(() => {
      const cachedRooms = privateChatCache.getRoomsList();
      if (cachedRooms) {
        setRooms(cachedRooms);
      }
    });

    return unsubscribe;
  }, []);

  const fetchRoomsAndContacts = useCallback(async () => {
    if (!privateChatCache.getRoomsList()) {
      setLoading(true);
    }
    setError("");

    try {
      const [roomsData, contactsData, broadcastsData] = await Promise.all([
        getMyRooms(50),
        getMyContacts(50).catch(() => [] as ContactIdentityResponse[]),
        getUserBroadcasts(1).catch(() => [] as IPublicBroadcast[]),
      ]);

      setRooms(roomsData);
      privateChatCache.setRoomsList(roomsData);

      if (broadcastsData.length > 0) {
        setLatestBroadcast(broadcastsData[0]);
      }

      const map: Record<string, ContactIdentityResponse> = {};
      for (const c of contactsData) {
        map[c.contactId] = c;
      }
      setInternalContacts(map);
    } catch (err) {
      if (!privateChatCache.getRoomsList()) {
        setError(err instanceof Error ? err.message : "Could not load conversations.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomsAndContacts();
  }, [fetchRoomsAndContacts]);

  // Real-time socket listeners for live updates
  useEffect(() => {
    const socket = getSocket();
    const handleNewBroadcast = (broadcast: IPublicBroadcast) => {
      setLatestBroadcast(broadcast);
    };

    const handleNewPrivateMessage = (message: any) => {
      if (!message || !message.roomId) return;
      privateChatCache.handleIncomingSocketMessage(message.roomId, message);
    };

    socket.on("broadcast:new", handleNewBroadcast);
    socket.on("private:message:new", handleNewPrivateMessage);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
      socket.off("private:message:new", handleNewPrivateMessage);
    };
  }, []);

  // Merged contacts (parent contacts override internal contacts)
  const effectiveContacts = useMemo(
    () => ({ ...internalContacts, ...contactsMap }),
    [internalContacts, contactsMap]
  );

  // Memoized filtered and sorted rooms
  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rooms;

    return rooms.filter((room) => {
      const otherId = room.participants.find((p) => p !== clientId) || room.participants[0];
      const isDeveloper = otherId === "admin";
      const displayName = isDeveloper
        ? "Reviewer Bucket Developer"
        : effectiveContacts[otherId]?.displayName || "Anonymous User";
      const lastContent = room.lastMessage?.content || "";
      return (
        displayName.toLowerCase().includes(q) ||
        otherId.toLowerCase().includes(q) ||
        lastContent.toLowerCase().includes(q)
      );
    });
  }, [rooms, searchQuery, effectiveContacts, clientId]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Search Bar */}
      <div className="p-3.5 border-b border-white/5 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white/5 border border-white/10 rounded-full text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Quick Navigation Header */}
      <div className="px-4 py-2.5 border-b border-white/5 bg-black flex items-center justify-between">
        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
          Conversations ({rooms.length})
        </span>
        <Link
          href="/community"
          className="text-[11px] font-normal text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Community</span>
        </Link>
      </div>

      {/* Scrollable Conversation List */}
      <ScrollArea className="flex-1 divide-y divide-white/5" role="list">
        {/* Pinned Official Reviewer Bucket Broadcast Channel */}
        <div role="listitem">
          <button
            type="button"
            onClick={onSelectBroadcast || (() => {})}
            className={`w-full text-left p-4 transition-colors relative block focus-visible:outline-none ${
              selectedRoomId === "broadcast"
                ? "bg-white/5"
                : "hover:bg-white/[0.02]"
            }`}
            aria-label={`Open Reviewer Bucket Official announcements${
              broadcastUnread > 0 ? ` (${broadcastUnread} unread)` : ""
            }`}
            aria-current={selectedRoomId === "broadcast" ? "page" : undefined}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-neutral-400 flex items-center justify-center text-[10px] font-medium shrink-0">
                  <Megaphone className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span
                    className={`text-xs truncate leading-tight ${
                      selectedRoomId === "broadcast"
                        ? "font-medium text-white"
                        : "font-normal text-neutral-200"
                    }`}
                  >
                    Reviewer Bucket
                  </span>
                  <span className="border border-white/10 text-neutral-400 bg-transparent text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                    Official
                  </span>
                </div>
              </div>

              {latestBroadcast?.createdAt && (
                <span className="text-[10px] text-neutral-500 font-normal shrink-0 tabular-nums">
                  {formatRelativeTime(latestBroadcast.createdAt)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pl-9.5">
              <p className="text-xs text-neutral-500 font-normal truncate leading-relaxed">
                {latestBroadcast?.content || "Official announcement channel"}
              </p>
              {broadcastUnread > 0 && (
                <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
                  {broadcastUnread > 9 ? "9+" : broadcastUnread}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Loading State */}
        {loading && rooms.length === 0 ? (
          <RoomSkeleton />
        ) : error && rooms.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-neutral-500 mx-auto" />
            <p className="text-xs text-neutral-400 font-normal">{error}</p>
            <button
              type="button"
              onClick={fetchRoomsAndContacts}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-semibold rounded-full transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 space-y-2">
            <MessageSquare className="w-7 h-7 text-neutral-600 mx-auto" />
            <p className="text-xs font-normal text-neutral-400">No conversations found.</p>
            <p className="text-[11px] text-neutral-500 font-normal">
              Start chatting with community members or message the developer.
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const otherId = room.participants.find((p) => p !== clientId) || room.participants[0];
            const isDeveloper = otherId === "admin";
            const displayName = isDeveloper
              ? "Reviewer Bucket Developer"
              : effectiveContacts[otherId]?.displayName || "Anonymous User";

            return (
              <div key={room.id} role="listitem">
                <ConversationItem
                  room={room}
                  displayName={displayName}
                  isDeveloper={isDeveloper}
                  currentUserId={clientId}
                  unreadCount={roomUnreadCounts[room.id] ?? room.unreadCount ?? 0}
                  isSelected={room.id === selectedRoomId}
                  onClick={onSelect}
                />
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
