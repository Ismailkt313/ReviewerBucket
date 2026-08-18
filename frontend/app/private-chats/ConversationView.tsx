"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo, JSX } from "react";
import {
  MoreVertical,
  Info,
  UserPen,
  Reply,
  X,
  Pencil,
  RefreshCw,
  User,
  Wrench,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import { getRoomById } from "@/app/services/private-rooms";
import { getMessages, sendMessage, IPrivateMessage } from "@/app/services/private-messages";
import { getContactIdentity, ContactIdentityResponse } from "@/app/services/private-contacts";
import { getSocket } from "@/app/utils/socket";
import { usePrivateUnread } from "@/app/hooks/usePrivateUnread";
import { privateChatCache } from "@/app/utils/private-chat-cache";
import ScrollArea from "@/app/components/ScrollArea";
import RenameContactModal from "./RenameContactModal";
import AnonymousInfoModal from "./AnonymousInfoModal";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameCalendarDay(date, today)) return "Today";
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function MessageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-4 py-4" aria-hidden="true">
      <div className="flex justify-start">
        <div className="flex flex-col gap-1.5 max-w-[60%]">
          <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-12 w-56 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="flex flex-col gap-1.5 items-end max-w-[60%]">
          <div className="h-3 w-8 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-10 w-44 bg-neutral-200 dark:bg-neutral-700 rounded-2xl animate-pulse" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="flex flex-col gap-1.5 max-w-[60%]">
          <div className="h-16 w-64 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
      <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-850 rounded animate-pulse" />
    </div>
  );
}

// ─── Date Separator ───────────────────────────────────────────────────────────

const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center my-4 select-none">
      <span className="px-3 py-0.5 rounded-full border border-border bg-surface text-[10px] font-medium text-muted uppercase tracking-wider shadow-xs">
        {label}
      </span>
    </div>
  );
});

// ─── Memoized Message Bubble ──────────────────────────────────────────────────

interface MessageBubbleProps {
  item: IPrivateMessage & {
    isGrouped: boolean;
    isGroupLast: boolean;
  };
  isMine: boolean;
  isHighlighted: boolean;
  onInitiateReply: (msg: IPrivateMessage) => void;
  onScrollToMessage: (id: string) => void;
  onRetryMessage: (msg: IPrivateMessage) => void;
  onDeleteFailedMessage: (tempId: string) => void;
  onTouchStart: (e: React.TouchEvent, msg: IPrivateMessage) => void;
  onTouchMove: (e: React.TouchEvent, msgId: string) => void;
  onTouchEnd: (e: React.TouchEvent, msg: IPrivateMessage) => void;
  swipingId: string | null;
  swipeOffset: number;
}

const MessageBubble = React.memo(
  function MessageBubble({
    item,
    isMine,
    isHighlighted,
    onInitiateReply,
    onScrollToMessage,
    onRetryMessage,
    onDeleteFailedMessage,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipingId,
    swipeOffset,
  }: MessageBubbleProps) {
    const isSending = item.status === "sending";
    const isFailed = item.status === "failed";
    const msgId = item.id || (item as any)._id || item.tempId;

    return (
      <div
        id={`msg-${msgId}`}
        onTouchStart={(e) => onTouchStart(e, item)}
        onTouchMove={(e) => onTouchMove(e, item.id || item.tempId || "")}
        onTouchEnd={(e) => onTouchEnd(e, item)}
        className={`flex w-full ${isMine ? "justify-end" : "justify-start"} ${
          isHighlighted ? "bg-neutral-100 dark:bg-neutral-800 py-1.5 rounded-xl px-2 transition-colors duration-500" : ""
        }`}
        style={{
          transform:
            swipingId === (item.id || item.tempId)
              ? `translateX(${swipeOffset}px)`
              : "translateX(0px)",
          transition:
            swipingId === (item.id || item.tempId)
              ? "none"
              : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div className="relative group max-w-[80%] flex items-center">
          <div
            className={`px-4 py-2.5 w-full rounded-2xl transition-opacity shadow-xs ${
              isMine
                ? isFailed
                  ? "bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400"
                  : "bg-bubble-mine text-bubble-mine-text"
                : "bg-bubble-other text-bubble-other-text border border-border/50"
            } ${isSending ? "opacity-80" : ""}`}
          >
            {/* Quoted Reply Block */}
            {item.replyTo && (
              <div
                onClick={() => onScrollToMessage(item.replyTo!.id)}
                className={`mb-2 cursor-pointer rounded-xl px-3 py-1.5 text-left transition-opacity select-none ${
                  isMine && !isFailed
                    ? "bg-black/10 dark:bg-white/15 border-l-2 border-l-current text-inherit opacity-90 hover:opacity-100"
                    : "bg-black/5 dark:bg-white/10 border-l-2 border-l-current text-inherit opacity-90 hover:opacity-100"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider font-bold block mb-0.5 opacity-70">
                  Reply
                </span>
                <p className="text-[11px] leading-snug line-clamp-1">
                  {item.replyTo.content}
                </p>
              </div>
            )}

            {/* Message Content */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {item.content}
            </p>

            {/* Message Timestamp & Status Indicator */}
            <div
              className={`flex items-center justify-end gap-1.5 mt-1 ${
                isMine && !isFailed ? "text-bubble-mine-text/70" : "text-bubble-other-text/70"
              }`}
            >
              <span className="text-[10px] tabular-nums select-none font-normal">
                {formatMessageTime(item.createdAt)}
              </span>

              {/* Status icon for outbound messages */}
              {isMine && (
                <span className="inline-flex items-center select-none" title={item.status || "sent"}>
                  {isSending ? (
                    <Clock className="w-3 h-3 text-bubble-mine-text/60 animate-pulse" />
                  ) : isFailed ? (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetryMessage(item);
                        }}
                        className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  ) : (
                    <Check className="w-3 h-3 text-bubble-mine-text/80" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Reply Action Button */}
          {!isFailed && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden md:flex flex-col gap-1 z-10 ${
                isMine ? "left-[-36px]" : "right-[-36px]"
              }`}
            >
              <button
                type="button"
                onClick={() => onInitiateReply(item)}
                className="p-1.5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors"
                aria-label="Reply to message"
                title="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.item.tempId === next.item.tempId &&
      prev.item.content === next.item.content &&
      prev.item.status === next.item.status &&
      prev.item.createdAt === next.item.createdAt &&
      prev.isMine === next.isMine &&
      prev.isHighlighted === next.isHighlighted &&
      prev.swipingId === next.swipingId &&
      prev.swipeOffset === next.swipeOffset &&
      prev.item.isGrouped === next.item.isGrouped &&
      prev.item.isGroupLast === next.item.isGroupLast
    );
  }
);

// ─── Component Props ───────────────────────────────────────────────────────────

export interface ConversationViewProps {
  roomId: string;
  onBack?: () => void;
  onContactUpdate?: (updated: ContactIdentityResponse) => void;
  initialContactIdentity?: ContactIdentityResponse;
}

export default function ConversationView({
  roomId,
  onBack,
  onContactUpdate,
  initialContactIdentity,
}: ConversationViewProps) {
  const clientId = getAnonymousClientId();
  const { markRoomRead } = usePrivateUnread();

  // Check initial cache synchronously for instant zero-lag switching
  const cachedData = useMemo(() => privateChatCache.getRoom(roomId), [roomId]);

  // State initialized directly from cache if available
  const [messages, setMessages] = useState<IPrivateMessage[]>(
    cachedData?.messages || []
  );
  const [messagesLoading, setMessagesLoading] = useState<boolean>(!cachedData);
  const [messagesError, setMessagesError] = useState("");
  const [roomLoading, setRoomLoading] = useState<boolean>(!cachedData?.roomDetails);
  const [roomError, setRoomError] = useState("");
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(
    cachedData?.roomDetails
      ? cachedData.roomDetails.participants.find((p) => p !== clientId) || cachedData.roomDetails.participants[0]
      : null
  );
  const [contactIdentity, setContactIdentity] = useState<ContactIdentityResponse | null>(
    initialContactIdentity || cachedData?.contactIdentity || null
  );
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  // Pagination
  const [hasMore, setHasMore] = useState(cachedData?.hasMore ?? false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(cachedData?.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Composer
  const [inputText, setInputText] = useState(privateChatCache.getDraftText(roomId));
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [replyingTo, setReplyingTo] = useState<IPrivateMessage | null>(null);

  // Modals & Menu
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // UI state
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [actionSheetMsg, setActionSheetMsg] = useState<IPrivateMessage | null>(null);

  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialScrollDone = useRef(false);

  // ── Sync with Cache on Cache Events ─────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = privateChatCache.subscribe((updatedRoomId) => {
      if (!updatedRoomId || updatedRoomId === roomId) {
        const cached = privateChatCache.getRoom(roomId);
        if (cached) {
          setMessages(cached.messages);
          setHasMore(cached.hasMore);
          setNextCursor(cached.nextCursor);
          if (cached.contactIdentity) {
            setContactIdentity(cached.contactIdentity);
          }
        }
      }
    });

    return unsubscribe;
  }, [roomId]);

  // ── Fetch room details (Cache-first with background revalidation) ───────────
  const fetchRoom = useCallback(async () => {
    const cached = privateChatCache.getRoom(roomId);
    if (!cached?.roomDetails) {
      setRoomLoading(true);
    }
    setRoomError("");

    try {
      const room = await getRoomById(roomId);
      const otherId = room.participants.find((p) => p !== clientId) || room.participants[0];
      setOtherParticipantId(otherId);

      privateChatCache.setRoomData(roomId, { roomDetails: room });

      if (otherId && otherId !== "admin") {
        getContactIdentity(otherId)
          .then((identity) => {
            setContactIdentity(identity);
            privateChatCache.setRoomData(roomId, { contactIdentity: identity });
            if (onContactUpdate) onContactUpdate(identity);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      if (!privateChatCache.getRoom(roomId)?.roomDetails) {
        setRoomError(err instanceof Error ? err.message : "Failed to load conversation details.");
      }
    } finally {
      setRoomLoading(false);
    }
  }, [roomId, clientId, onContactUpdate]);

  // ── Fetch messages (Initial batch of 30, background revalidation) ───────────
  const fetchMessages = useCallback(async () => {
    const cached = privateChatCache.getRoom(roomId);
    if (!cached || cached.messages.length === 0) {  
      setMessagesLoading(true);
    }
    setMessagesError("");

    try {
      const result = await getMessages(roomId, 30);
      
      // Preserve any local optimistic "sending" or "failed" messages
      const currentCache = privateChatCache.getRoom(roomId);
      const pendingOptimistic = (currentCache?.messages || []).filter(
        (m) => m.status === "sending" || m.status === "failed"
      );

      const serverIds = new Set(result.messages.map((m) => m.id || (m as any)._id));
      const filteredOptimistic = pendingOptimistic.filter(
        (m) => !serverIds.has(m.id) && !serverIds.has(m.tempId || "")
      );
      const merged = [...result.messages, ...filteredOptimistic];

      // If messages changed or initial load, update state and cache
      const isDifferent =
        merged.length !== (currentCache?.messages.length || 0) ||
        merged.some((m: IPrivateMessage, idx: number) => m.id !== currentCache?.messages[idx]?.id || m.status !== currentCache?.messages[idx]?.status);

      if (isDifferent) {
        setMessages(merged);
        privateChatCache.setRoomData(roomId, {
          messages: merged,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
      }

      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);

      markRoomRead(roomId);

      if (!isInitialScrollDone.current) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isInitialScrollDone.current = true;
          }
        });
      }
    } catch (err: unknown) {
      if (!privateChatCache.getRoom(roomId)?.messages.length) {
        setMessagesError(err instanceof Error ? err.message : "Failed to load messages.");
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [roomId, markRoomRead]);

  // When roomId changes: reset initial scroll flag & load room data synchronously
  useEffect(() => {
    isInitialScrollDone.current = false;
    const cached = privateChatCache.getRoom(roomId);
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setNextCursor(cached.nextCursor);
      setMessagesLoading(cached.messages.length === 0);
      if (cached.roomDetails) {
        const otherId = cached.roomDetails.participants.find((p) => p !== clientId) || cached.roomDetails.participants[0];
        setOtherParticipantId(otherId);
        setRoomLoading(false);
      } else {
        setRoomLoading(true);
      }
      if (cached.contactIdentity) {
        setContactIdentity(cached.contactIdentity);
      } else if (initialContactIdentity) {
        setContactIdentity(initialContactIdentity);
      }
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          isInitialScrollDone.current = true;
        }
      });
    } else {
      setMessages([]);
      setMessagesLoading(true);
      setRoomLoading(true);
      setOtherParticipantId(null);
      setContactIdentity(initialContactIdentity || null);
    }

    setInputText(privateChatCache.getDraftText(roomId));
    setReplyingTo(null);
    setSendError("");
    fetchRoom();
    fetchMessages();
  }, [roomId, fetchRoom, fetchMessages, clientId, initialContactIdentity]);

  // ── Sockets ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const joinRoom = () => {
      socket.emit("join:private-room", { roomId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on("connect", joinRoom);
    }

    const handleNewMessage = (msg: IPrivateMessage & { roomId?: string }) => {
      if (msg.roomId && msg.roomId !== roomId) return;

      privateChatCache.handleIncomingSocketMessage(roomId, msg);
      markRoomRead(roomId);

      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        } else {
          setShowNewMessageBanner(true);
        }
      }
    };

    const handleUserOnline = ({ userId }: { userId: string }) => {
      if (userId === otherParticipantId) setIsOtherUserOnline(true);
    };

    const handleUserOffline = ({ userId }: { userId: string }) => {
      if (userId === otherParticipantId) setIsOtherUserOnline(false);
    };

    socket.on("private:message:new", handleNewMessage);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);

    return () => {
      socket.emit("leave:private-room", { roomId });
      socket.off("connect", joinRoom);
      socket.off("private:message:new", handleNewMessage);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
    };
  }, [roomId, markRoomRead, otherParticipantId]);

  // ── Close menu on outside click ─────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Reply helpers ───────────────────────────────────────────────────────────
  const handleInitiateReply = useCallback((msg: IPrivateMessage) => {
    setReplyingTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleScrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const handleTouchStartMessage = useCallback((e: React.TouchEvent, msg: IPrivateMessage) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    setSwipingId(msg.id || msg.tempId || "");
    setSwipeOffset(0);

    longPressTimerRef.current = setTimeout(() => {
      setActionSheetMsg(msg);
    }, 500);
  }, []);

  const handleTouchMoveMessage = useCallback(
    (e: React.TouchEvent, msgId: string) => {
      if (!touchStartRef.current || swipingId !== msgId) return;
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;

      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      if (deltaX > 0) {
        const capped = Math.min(deltaX, 80);
        setSwipeOffset(capped);
      }
    },
    [swipingId]
  );

  const handleTouchEndMessage = useCallback(
    (e: React.TouchEvent, msg: IPrivateMessage) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const currentId = msg.id || msg.tempId;
      if (swipingId === currentId) {
        if (swipeOffset >= 50) {
          handleInitiateReply(msg);
        }
        setSwipingId(null);
        setSwipeOffset(0);
      }
      touchStartRef.current = null;
    },
    [swipingId, swipeOffset, handleInitiateReply]
  );

  // ── Load older messages (Pagination / Infinite scroll) ───────────────────────
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    const scrollContainer = scrollRef.current;
    const prevScrollHeight = scrollContainer?.scrollHeight ?? 0;
    const prevScrollTop = scrollContainer?.scrollTop ?? 0;

    try {
      const result = await getMessages(roomId, 30, nextCursor);
      
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id || (m as any)._id || m.tempId));
        const newMsgs = result.messages.filter((m) => !existingIds.has(m.id || (m as any)._id));
        const merged = [...newMsgs, ...prev];

        privateChatCache.setRoomData(roomId, {
          messages: merged,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });

        return merged;
      });

      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);

      // Preserve exact scroll position seamlessly
      requestAnimationFrame(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, roomId]);

  // ── Intersection Observer for infinite scroll ───────────────────────────────
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !messagesLoading) {
          handleLoadMore();
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, messagesLoading, handleLoadMore]);

  // ── Send Message with Optimistic UI ─────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !clientId) return;
    if (trimmed.length > 2000) {
      setSendError("Message cannot exceed 2000 characters.");
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const replySnapshot = replyingTo
      ? {
          id: replyingTo.id,
          senderId: replyingTo.senderId,
          content: replyingTo.content,
        }
      : null;

    const optimisticMessage: IPrivateMessage = {
      id: tempId,
      tempId,
      roomId,
      senderId: clientId,
      content: trimmed,
      replyTo: replySnapshot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "sending",
    };

    // 1. Instantly append to state and cache
    privateChatCache.appendOptimisticMessage(roomId, optimisticMessage);
    setInputText("");
    privateChatCache.setDraftText(roomId, "");
    setReplyingTo(null);
    setSendError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }

    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });

    // 2. Perform backend API call asynchronously
    try {
      const serverMsg = await sendMessage(roomId, trimmed, replySnapshot?.id);
      privateChatCache.resolveOptimisticMessage(roomId, tempId, serverMsg);
    } catch {
      privateChatCache.markOptimisticMessageFailed(roomId, tempId);
    }
  }, [inputText, isSending, clientId, roomId, replyingTo]);

  // ── Retry Failed Message ────────────────────────────────────────────────────
  const handleRetryMessage = useCallback(
    async (msg: IPrivateMessage) => {
      const tempId = msg.tempId || msg.id;
      // Set back to sending status
      privateChatCache.setRoomData(roomId, {
        messages: (privateChatCache.getRoom(roomId)?.messages || []).map((m) =>
          (m.tempId === tempId || m.id === tempId) ? { ...m, status: "sending" } : m
        ),
      });

      try {
        const serverMsg = await sendMessage(roomId, msg.content, msg.replyTo?.id);
        privateChatCache.resolveOptimisticMessage(roomId, tempId, serverMsg);
      } catch {
        privateChatCache.markOptimisticMessageFailed(roomId, tempId);
      }
    },
    [roomId]
  );

  const handleDeleteFailedMessage = useCallback(
    (tempId: string) => {
      privateChatCache.removeOptimisticMessage(roomId, tempId);
    },
    [roomId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInputText(val);
      privateChatCache.setDraftText(roomId, val);
      setSendError("");
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [roomId]
  );

  const handleContactRenamed = useCallback(
    (updated: ContactIdentityResponse) => {
      setContactIdentity(updated);
      privateChatCache.setRoomData(roomId, { contactIdentity: updated });
      if (onContactUpdate) {
        onContactUpdate(updated);
      }
    },
    [roomId, onContactUpdate]
  );

  // ── Build Grouped Messages List (Memoized for high performance) ─────────────
  const groupedMessageList = useMemo(() => {
    const result: Array<
      | { type: "separator"; label: string; key: string }
      | (IPrivateMessage & {
          type: "message";
          isGrouped: boolean;
          isGroupLast: boolean;
        })
    > = [];

    let lastDate: Date | null = null;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgDate = new Date(msg.createdAt);

      if (!lastDate || !isSameCalendarDay(lastDate, msgDate)) {
        result.push({
          type: "separator",
          label: getDateLabel(msgDate),
          key: `sep-${msgDate.toISOString()}-${i}`,
        });
        lastDate = msgDate;
      }

      const prevMsg = i > 0 ? messages[i - 1] : null;
      const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;

      const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
      const nextDate = nextMsg ? new Date(nextMsg.createdAt) : null;

      const isGrouped =
        !!prevMsg &&
        prevMsg.senderId === msg.senderId &&
        !!prevDate &&
        isSameCalendarDay(prevDate, msgDate) &&
        msgDate.getTime() - prevDate.getTime() < 5 * 60 * 1000;

      const isGroupLast =
        !nextMsg ||
        nextMsg.senderId !== msg.senderId ||
        !nextDate ||
        !isSameCalendarDay(nextDate, msgDate) ||
        nextDate.getTime() - msgDate.getTime() >= 5 * 60 * 1000;

      result.push({
        ...msg,
        type: "message",
        isGrouped,
        isGroupLast,
      });
    }

    return result;
  }, [messages]);

  // ── Render: room error ──────────────────────────────────────────────────────
  if (!roomLoading && roomError && messages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-black">
        {onBack && (
          <header className="flex-shrink-0 border-b border-white/5 bg-black px-4 py-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </header>
        )}
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-xs space-y-3">
            <p className="text-sm font-medium text-white">{roomError}</p>
            <button
              type="button"
              onClick={() => {
                fetchRoom();
                fetchMessages();
              }}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-semibold rounded-full transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDeveloperRoom = otherParticipantId === "admin";
  const displayName = isDeveloperRoom
    ? "Reviewer Bucket Developer"
    : contactIdentity?.displayName || "Anonymous User";

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden min-w-0 text-foreground">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border bg-surface/95 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full border border-border text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Back to conversations"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-border text-secondary flex items-center justify-center text-xs font-medium shrink-0">
            {isDeveloperRoom ? <Wrench className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            {roomLoading && !otherParticipantId ? (
              <HeaderSkeleton />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
                  {isDeveloperRoom ? (
                    <span className="border border-border text-muted bg-surface/50 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                      Developer Chat
                    </span>
                  ) : (
                    <span className="border border-border text-muted bg-surface/50 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                      Private 1-on-1
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {!isDeveloperRoom && isOtherUserOnline && (
                    <span className="flex h-1.5 w-1.5 relative flex-shrink-0" title="Online">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                  )}
                  <p className="text-[11px] text-muted font-normal truncate">
                    {isDeveloperRoom
                      ? "Official Developer Support"
                      : isOtherUserOnline
                      ? "Online now"
                      : "Anonymous Community Member"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isDeveloperRoom && (
            <button
              type="button"
              onClick={() => setIsRenameModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Rename contact locally"
            >
              <Pencil className="w-3.5 h-3.5 text-muted" />
              <span className="hidden sm:inline">Rename</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchMessages}
            disabled={messagesLoading}
            className="p-2 text-secondary hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
            aria-label="Refresh messages"
            title="Refresh messages"
          >
            <RefreshCw className={`w-4 h-4 ${messagesLoading ? "animate-spin" : ""}`} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-2 text-secondary hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1.5 z-30 w-48 rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
                {!isDeveloperRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsRenameModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <UserPen className="w-3.5 h-3.5 text-muted" />
                    <span>Rename Contact</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInfoModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                >
                  <Info className="w-3.5 h-3.5 text-muted" />
                  <span>Anonymous Chat Info</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Thread */}
      <ScrollArea
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight < 100) {
              setShowNewMessageBanner(false);
            }
          }
        }}
        className="flex-1 min-h-0 w-full p-4 sm:p-6 space-y-4 bg-background"
        aria-label="Conversation messages"
      >
        {/* Top Sentinel for Infinite Scroll Intersection Observer */}
        <div ref={topSentinelRef} className="h-1 w-full pointer-events-none" />

        {/* Load More Indicator / Button */}
        {hasMore && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-3 py-1 rounded-full border border-border text-[11px] text-muted font-medium hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 shadow-xs"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading older messages…</span>
                </>
              ) : (
                <span>Load older messages</span>
              )}
            </button>
          </div>
        )}

        {/* Initial Loading Skeleton */}
        {messagesLoading && messages.length === 0 && <MessageSkeleton />}

        {/* Messages Error */}
        {!messagesLoading && messagesError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <p className="text-xs text-muted font-normal">{messagesError}</p>
            <button
              type="button"
              onClick={fetchMessages}
              className="px-3.5 py-1.5 bg-foreground text-background hover:opacity-90 text-xs font-semibold rounded-full transition-opacity"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 text-center select-none space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-border text-secondary flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Start the conversation</p>
              <p className="text-xs text-muted font-normal max-w-xs mx-auto">
                Send a message to start chatting anonymously in this private thread.
              </p>
            </div>
          </div>
        )}

        {/* Memoized Message Bubbles */}
        {groupedMessageList.map((item) => {
          if (item.type === "separator") {
            return <DateSeparator key={item.key} label={item.label} />;
          }

          const isMine = item.senderId === clientId;
          const msgKey = item.id || (item as any)._id || item.tempId;

          return (
            <MessageBubble
              key={msgKey}
              item={item}
              isMine={isMine}
              isHighlighted={highlightedMessageId === item.id}
              onInitiateReply={handleInitiateReply}
              onScrollToMessage={handleScrollToMessage}
              onRetryMessage={handleRetryMessage}
              onDeleteFailedMessage={handleDeleteFailedMessage}
              onTouchStart={handleTouchStartMessage}
              onTouchMove={handleTouchMoveMessage}
              onTouchEnd={handleTouchEndMessage}
              swipingId={swipingId}
              swipeOffset={swipeOffset}
            />
          );
        })}

        {/* New Messages Floating Button */}
        {showNewMessageBanner && (
          <div className="sticky bottom-2 z-30 flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                }
                setShowNewMessageBanner(false);
              }}
              className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold shadow-lg hover:opacity-90 transition-transform hover:scale-105 active:scale-95"
            >
              <span>New messages</span>
            </button>
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border bg-surface shrink-0">
        {/* Reply Preview Banner */}
        {replyingTo && (
          <div className="border-b border-border bg-neutral-50 dark:bg-neutral-900/60 px-4 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start gap-2.5 min-w-0 border-l-2 border-l-foreground pl-2.5">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted">
                  Replying to Message
                </span>
                <p className="text-xs text-foreground line-clamp-1 leading-relaxed">
                  {replyingTo.content}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-muted hover:text-foreground rounded-md transition-colors"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center w-full bg-background border border-border rounded-full px-4 py-2 gap-2 focus-within:border-foreground/30 focus-within:ring-1 focus-within:ring-foreground/10 transition-all shadow-xs"
          >
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isDeveloperRoom ? "Send a message to Developer…" : "Type your message…"
              }
              maxLength={2000}
              rows={1}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted text-xs sm:text-sm focus:outline-none resize-none min-h-[22px] max-h-[120px] py-1 leading-normal"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="text-secondary hover:text-foreground transition-colors p-2 rounded-full disabled:opacity-30 flex items-center justify-center shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {sendError && (
            <p className="text-[11px] text-red-500 font-normal mt-1.5 px-4">{sendError}</p>
          )}
        </div>
      </div>

      {/* Rename contact modal */}
      {otherParticipantId && (
        <RenameContactModal
          key={`${otherParticipantId}-${contactIdentity?.nickname || ""}-${isRenameModalOpen}`}
          isOpen={isRenameModalOpen}
          contactId={otherParticipantId}
          currentNickname={contactIdentity?.nickname || null}
          isCustomName={contactIdentity?.isCustomName || false}
          onClose={() => setIsRenameModalOpen(false)}
          onSuccess={handleContactRenamed}
        />
      )}

      {/* Anonymous info modal */}
      <AnonymousInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      {/* Mobile long-press action sheet */}
      {actionSheetMsg && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 backdrop-blur-xs"
            onClick={() => setActionSheetMsg(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Message actions"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface border-t border-border shadow-2xl animate-in slide-in-from-bottom-4 duration-200 pb-[env(safe-area-inset-bottom)] text-foreground"
          >
            <div className="flex flex-col">
              <div className="flex justify-center py-2.5">
                <div className="w-8 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleInitiateReply(actionSheetMsg);
                  setActionSheetMsg(null);
                }}
                className="flex items-center gap-3 w-full px-5 py-3.5 text-left text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Reply className="w-4 h-4 text-muted" />
                <span>Reply</span>
              </button>
              <div className="h-px bg-border mx-5 my-1" />
              <button
                type="button"
                onClick={() => setActionSheetMsg(null)}
                className="flex items-center justify-center w-full px-5 py-3.5 text-sm font-medium text-muted hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
