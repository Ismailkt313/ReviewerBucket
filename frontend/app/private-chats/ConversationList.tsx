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
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-28" />
            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-44" />
          </div>
          <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-8 shrink-0" />
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
        className={`w-full text-left p-4 transition-colors relative block group focus-visible:outline-none ${
          isSelected
            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground border-l-2 border-l-foreground"
            : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 text-foreground"
        }`}
        aria-label={`Open conversation with ${displayName}${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-current={isSelected ? "page" : undefined}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 border transition-colors ${
                isSelected
                  ? "bg-neutral-200 dark:bg-neutral-700 border-foreground/20 text-foreground"
                  : "bg-neutral-100 dark:bg-neutral-800 border-border text-secondary group-hover:text-foreground group-hover:border-foreground/20"
              }`}
            >
              {isDeveloper ? <Wrench className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>

            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span
                className={`text-xs truncate leading-tight text-foreground transition-colors ${
                  isSelected ? "font-bold" : "font-semibold group-hover:text-foreground"
                }`}
              >
                {displayName}
              </span>
              {isDeveloper && (
                <span className="border border-border text-muted bg-surface/50 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                  Developer
                </span>
              )}
            </div>
          </div>

          {timeString && (
            <span className="text-[10px] text-muted group-hover:text-secondary font-normal shrink-0 tabular-nums transition-colors">
              {formatRelativeTime(timeString)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pl-9.5">
          <p className="text-xs text-muted group-hover:text-secondary font-normal truncate leading-relaxed transition-colors">
            {room.lastMessage?.content ? (
              <>
                {isMine && <span className="font-normal text-secondary group-hover:text-foreground">You: </span>}
                {room.lastMessage.content}
              </>
            ) : (
              <span className="italic text-muted/70 text-[11px]">No messages yet</span>
            )}
          </p>

          {unreadCount > 0 && (
            <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
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
      const [roomsData, contactsData, broadcastData] = await Promise.all([
        getMyRooms(),
        getMyContacts(),
        getUserBroadcasts(1).catch(() => []),
      ]);

      // Cache the fetched rooms
      privateChatCache.setRoomsList(roomsData);
      setRooms(roomsData);

      const contactMap: Record<string, ContactIdentityResponse> = {};
      for (const c of contactsData) {
        contactMap[c.contactId] = c;
      }
      setInternalContacts(contactMap);

      if (broadcastData && broadcastData.length > 0) {
        setLatestBroadcast(broadcastData[0]);
      }
    } catch (err: unknown) {
      if (!privateChatCache.getRoomsList()) {
        setError(err instanceof Error ? err.message : "Failed to load conversations.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomsAndContacts();
  }, [fetchRoomsAndContacts]);

  // Real-time listener for new broadcast announcements
  useEffect(() => {
    const socket = getSocket();

    const handleNewBroadcast = (newBroadcast: IPublicBroadcast) => {
      setLatestBroadcast(newBroadcast);
    };

    socket.on("broadcast:new", handleNewBroadcast);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
    };
  }, []);

  const effectiveContacts = useMemo(() => {
    return { ...internalContacts, ...contactsMap };
  }, [internalContacts, contactsMap]);

  // Helper to extract timestamp numeric value for sorting
  const getRoomTimestamp = (room: IPrivateRoom): number => {
    if (room.lastMessage?.createdAt) {
      const t = new Date(room.lastMessage.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (room.updatedAt) {
      const t = new Date(room.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (room.createdAt) {
      const t = new Date(room.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  // WhatsApp-style: sort non-broadcast rooms by latest message timestamp descending
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => getRoomTimestamp(b) - getRoomTimestamp(a));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return sortedRooms;

    return sortedRooms.filter((room) => {
      const otherId = room.participants.find((p) => p !== clientId) || room.participants[0];
      const isDeveloper = otherId === "admin";
      const displayName = isDeveloper
        ? "Reviewer Bucket Developer"
        : effectiveContacts[otherId]?.displayName || "Anonymous User";

      const nameMatch = displayName.toLowerCase().includes(query);
      const lastMsgMatch = room.lastMessage?.content?.toLowerCase().includes(query) ?? false;
      return nameMatch || lastMsgMatch;
    });
  }, [sortedRooms, searchQuery, clientId, effectiveContacts]);

  const shouldShowBroadcast = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      "reviewer bucket".includes(query) ||
      "official".includes(query) ||
      "announcement".includes(query) ||
      (latestBroadcast?.content?.toLowerCase().includes(query) ?? false)
    );
  }, [searchQuery, latestBroadcast]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface text-foreground" role="region" aria-label="Conversations Sidebar">
      {/* Search Bar Header */}
      <div className="p-3.5 border-b border-border space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-full text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-colors"
          />
        </div>
      </div>

      {/* Quick Navigation Header */}
      <div className="px-4 py-2.5 border-b border-border bg-surface flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
          Conversations ({rooms.length})
        </span>
        <Link
          href="/community"
          className="text-[11px] font-normal text-muted hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Community</span>
        </Link>
      </div>

      {/* Scrollable Conversation List */}
      <ScrollArea className="flex-1 divide-y divide-border" role="list">
        {/* Pinned Official Reviewer Bucket Broadcast Channel */}
        {shouldShowBroadcast && (
          <div role="listitem">
          <button
            type="button"
            onClick={onSelectBroadcast || (() => {})}
            className={`w-full text-left p-4 transition-colors relative block group focus-visible:outline-none ${
              selectedRoomId === "broadcast"
                ? "bg-amber-500/[0.08] border-l-2 border-l-amber-500 text-foreground"
                : "hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 text-foreground"
            }`}
            aria-label={`Open Reviewer Bucket Official announcements${
              broadcastUnread > 0 ? ` (${broadcastUnread} unread)` : ""
            }`}
            aria-current={selectedRoomId === "broadcast" ? "page" : undefined}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/30 dark:border-amber-400/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-medium shrink-0">
                  <Megaphone className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span
                    className={`text-xs truncate leading-tight ${
                      selectedRoomId === "broadcast"
                        ? "font-bold text-foreground"
                        : "font-semibold text-foreground/90"
                    }`}
                  >
                    Reviewer Bucket
                  </span>
                  <span className="bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/30 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                    Official
                  </span>
                </div>
              </div>

              {latestBroadcast?.createdAt && (
                <span className="text-[10px] text-muted font-normal shrink-0 tabular-nums">
                  {formatRelativeTime(latestBroadcast.createdAt)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pl-9.5">
              <p className="text-xs text-muted font-normal truncate leading-relaxed">
                {latestBroadcast?.broadcastType === "POSTER" || latestBroadcast?.posterImageUrl ? (
                  <>
                    <span className="font-semibold text-foreground/85">🖼️ Poster: </span>
                    {latestBroadcast.title || latestBroadcast.content}
                  </>
                ) : (
                  latestBroadcast?.content || "Official announcement channel"
                )}
              </p>
              {broadcastUnread > 0 && (
                <span className="flex-shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-2xs">
                  {broadcastUnread > 9 ? "9+" : broadcastUnread}
                </span>
              )}
            </div>
          </button>
        </div>
        )}

        {/* Loading State */}
        {loading && rooms.length === 0 ? (
          <RoomSkeleton />
        ) : error && rooms.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-muted mx-auto" />
            <p className="text-xs text-muted font-normal">{error}</p>
            <button
              type="button"
              onClick={fetchRoomsAndContacts}
              className="px-3.5 py-1.5 bg-foreground text-background hover:opacity-90 text-xs font-semibold rounded-full transition-opacity"
            >
              Retry
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-8 text-center text-muted space-y-2">
            <MessageSquare className="w-7 h-7 text-muted/60 mx-auto" />
            <p className="text-xs font-normal text-foreground">No conversations found.</p>
            <p className="text-[11px] text-muted font-normal">
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
