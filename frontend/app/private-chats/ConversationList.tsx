"use client";

import { useEffect, useCallback, useState, JSX } from "react";
import Link from "next/link";
import { Megaphone, Search, User, Wrench, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { getMyRooms, IPrivateRoom } from "@/app/services/private-rooms";
import { getMyContacts, ContactIdentityResponse } from "@/app/services/private-contacts";
import { getUserBroadcasts, IPublicBroadcast } from "@/app/services/broadcasts";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import { getSocket } from "@/app/utils/socket";
import { usePrivateUnread } from "../hooks/usePrivateUnread";
import { useBroadcastUnread } from "../hooks/useBroadcastUnread";

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
          <div className="w-8 h-8 rounded-full bg-elevated shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 bg-elevated rounded w-28" />
            <div className="h-3 bg-elevated/70 rounded w-44" />
          </div>
          <div className="h-3 bg-elevated/50 rounded w-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Single Room Row ──────────────────────────────────────────────────────────

interface ConversationItemProps {
  room: IPrivateRoom;
  isSelected: boolean;
  displayName: string;
  isDeveloper?: boolean;
  currentUserId?: string;
  unreadCount?: number;
  onClick: () => void;
}

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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 transition-colors relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
        isSelected
          ? "bg-elevated border-l-4 border-l-blue-500"
          : "hover:bg-elevated/50"
      }`}
      aria-label={`Open conversation with ${displayName}${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      aria-current={isSelected ? "page" : undefined}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              isDeveloper
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isDeveloper ? <Wrench className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
          </div>

          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <span
              className={`text-xs truncate leading-tight ${
                isSelected ? "font-bold text-foreground" : "font-semibold text-foreground"
              }`}
            >
              {displayName}
            </span>
            {isDeveloper && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0">
                Developer
              </span>
            )}
          </div>
        </div>

        {timeString && (
          <span className="text-[10px] text-muted shrink-0 tabular-nums">
            {formatRelativeTime(timeString)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pl-9.5">
        <p className="text-xs text-secondary truncate leading-relaxed">
          {room.lastMessage?.content ? (
            <>
              {isMine && <span className="font-medium text-foreground">You: </span>}
              {room.lastMessage.content}
            </>
          ) : (
            <span className="italic text-muted text-[11px]">No messages yet</span>
          )}
        </p>

        {unreadCount > 0 && (
          <span className="flex-shrink-0 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-background shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}

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
  const [rooms, setRooms] = useState<IPrivateRoom[]>([]);
  const [latestBroadcast, setLatestBroadcast] = useState<IPublicBroadcast | null>(null);
  const [internalContacts, setInternalContacts] = useState<Record<string, ContactIdentityResponse>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRoomsAndContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roomsData, contactsData, broadcastsData] = await Promise.all([
        getMyRooms(50),
        getMyContacts(50).catch(() => [] as ContactIdentityResponse[]),
        getUserBroadcasts(1).catch(() => [] as IPublicBroadcast[]),
      ]);

      setRooms(roomsData);
      if (broadcastsData.length > 0) {
        setLatestBroadcast(broadcastsData[0]);
      }

      const map: Record<string, ContactIdentityResponse> = {};
      for (const c of contactsData) {
        map[c.contactId] = c;
      }
      setInternalContacts(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomsAndContacts();
  }, [fetchRoomsAndContacts]);

  // Real-time socket listeners for incoming broadcast and private message updates
  useEffect(() => {
    const socket = getSocket();
    const handleNewBroadcast = (broadcast: IPublicBroadcast) => {
      setLatestBroadcast(broadcast);
    };

    const handleNewPrivateMessage = (message: any) => {
      if (!message || !message.roomId) return;
      setRooms((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === message.roomId);
        if (existingIndex === -1) return prev;

        const updatedRoom: IPrivateRoom = {
          ...prev[existingIndex],
          lastMessage: {
            id: message.id || message._id,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt || new Date().toISOString(),
          },
          updatedAt: message.createdAt || new Date().toISOString(),
        };

        const remaining = prev.filter((_, i) => i !== existingIndex);
        return [updatedRoom, ...remaining];
      });
    };

    socket.on("broadcast:new", handleNewBroadcast);
    socket.on("private:message:new", handleNewPrivateMessage);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
      socket.off("private:message:new", handleNewPrivateMessage);
    };
  }, []);

  // Merged contacts (parent contacts override internal contacts)
  const effectiveContacts = { ...internalContacts, ...contactsMap };

  // Filtered rooms based on search query
  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
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

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Search Bar */}
      <div className="p-3.5 border-b border-border space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Quick Navigation Header */}
      <div className="px-3.5 py-2 border-b border-border bg-surface/50 flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
          Conversations ({rooms.length})
        </span>
        <Link
          href="/community"
          className="text-[11px] font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Community</span>
        </Link>
      </div>

      {/* Scrollable Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border" role="list">
        {/* Pinned Official Reviewer Bucket Broadcast Channel */}
        <div role="listitem">
          <button
            type="button"
            onClick={onSelectBroadcast || (() => {})}
            className={`w-full text-left p-4 transition-colors relative block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
              selectedRoomId === "broadcast"
                ? "bg-elevated border-l-4 border-l-blue-500"
                : "hover:bg-elevated/50"
            }`}
            aria-label={`Open Reviewer Bucket Official announcements${
              broadcastUnread > 0 ? ` (${broadcastUnread} unread)` : ""
            }`}
            aria-current={selectedRoomId === "broadcast" ? "page" : undefined}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  <Megaphone className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span
                    className={`text-xs truncate leading-tight ${
                      selectedRoomId === "broadcast"
                        ? "font-bold text-foreground"
                        : "font-semibold text-foreground"
                    }`}
                  >
                    Reviewer Bucket
                  </span>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-500/15 text-blue-500 dark:text-blue-400 uppercase tracking-wider shrink-0">
                    Official
                  </span>
                </div>
              </div>

              {latestBroadcast?.createdAt && (
                <span className="text-[10px] text-muted shrink-0 tabular-nums">
                  {formatRelativeTime(latestBroadcast.createdAt)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pl-9.5">
              <p className="text-xs text-secondary truncate leading-relaxed">
                {latestBroadcast?.content || "Official announcement channel"}
              </p>
              {broadcastUnread > 0 && (
                <span className="flex-shrink-0 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                  {broadcastUnread > 9 ? "9+" : broadcastUnread}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <RoomSkeleton />
        ) : error ? (
          <div className="p-6 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <p className="text-xs text-muted">{error}</p>
            <button
              type="button"
              onClick={fetchRoomsAndContacts}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-8 text-center text-muted space-y-2">
            <MessageSquare className="w-8 h-8 text-muted/50 mx-auto" />
            <p className="text-xs font-medium">No conversations found.</p>
            <p className="text-[11px] text-muted">
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
                  onClick={() => onSelect(room)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
