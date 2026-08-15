"use client";

import { useEffect, useRef, useState, useCallback, JSX } from "react";
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
  ShieldCheck,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import { getRoomById } from "@/app/services/private-rooms";
import { getMessages, sendMessage, IPrivateMessage } from "@/app/services/private-messages";
import { getContactIdentity, ContactIdentityResponse } from "@/app/services/private-contacts";
import { getSocket } from "@/app/utils/socket";
import { usePrivateUnread } from "@/app/hooks/usePrivateUnread";
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

// ─── Skeletons ────────────────────────────────────────────────────────────────

function MessageSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-4 py-4" aria-hidden="true">
      <div className="flex justify-start">
        <div className="flex flex-col gap-1.5 max-w-[60%]">
          <div className="h-3 w-16 bg-elevated rounded animate-pulse" />
          <div className="h-12 w-56 bg-elevated rounded-2xl rounded-tl-xs animate-pulse" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="flex flex-col gap-1.5 items-end max-w-[60%]">
          <div className="h-3 w-8 bg-elevated rounded animate-pulse" />
          <div className="h-10 w-44 bg-elevated rounded-2xl rounded-tr-xs animate-pulse" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="flex flex-col gap-1.5 max-w-[60%]">
          <div className="h-16 w-64 bg-elevated rounded-2xl rounded-tl-xs animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      <div className="h-4 w-32 bg-elevated rounded animate-pulse" />
      <div className="h-3 w-20 bg-elevated/70 rounded animate-pulse" />
    </div>
  );
}

// ─── Date grouping utilities ───────────────────────────────────────────────────

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

type MessageListItem =
  | { type: "separator"; label: string; key: string }
  | (IPrivateMessage & {
      type: "message";
      isGrouped: boolean;
      isGroupLast: boolean;
    });

function buildMessageList(rawMessages: IPrivateMessage[]): MessageListItem[] {
  const result: MessageListItem[] = [];
  let lastDate: Date | null = null;

  for (let i = 0; i < rawMessages.length; i++) {
    const msg = rawMessages[i];
    const msgDate = new Date(msg.createdAt);

    if (!lastDate || !isSameCalendarDay(lastDate, msgDate)) {
      result.push({
        type: "separator",
        label: getDateLabel(msgDate),
        key: `sep-${msgDate.toISOString()}-${i}`,
      });
      lastDate = msgDate;
    }

    const prevMsg = i > 0 ? rawMessages[i - 1] : null;
    const nextMsg = i < rawMessages.length - 1 ? rawMessages[i + 1] : null;

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
}

function DateSeparator({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center my-4 select-none">
      <span className="px-3 py-1 rounded-full bg-surface border border-border text-[10px] font-bold text-muted uppercase tracking-wider shadow-2xs">
        {label}
      </span>
    </div>
  );
}

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

  // State
  const [messages, setMessages] = useState<IPrivateMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState("");
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [contactIdentity, setContactIdentity] = useState<ContactIdentityResponse | null>(
    initialContactIdentity || null
  );
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Composer
  const [inputText, setInputText] = useState("");
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch room details ──────────────────────────────────────────────────────
  const fetchRoom = useCallback(async () => {
    setRoomLoading(true);
    setRoomError("");
    try {
      const room = await getRoomById(roomId);
      const otherId = room.participants.find((p) => p !== clientId) || room.participants[0];
      setOtherParticipantId(otherId);

      if (otherId && otherId !== "admin") {
        getContactIdentity(otherId)
          .then((identity) => {
            setContactIdentity(identity);
            if (onContactUpdate) onContactUpdate(identity);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      setRoomError(err instanceof Error ? err.message : "Failed to load conversation details.");
    } finally {
      setRoomLoading(false);
    }
  }, [roomId, clientId, onContactUpdate]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    setMessagesError("");
    try {
      const result = await getMessages(roomId, 50);
      setMessages(result.messages);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      markRoomRead(roomId);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    } catch (err: unknown) {
      setMessagesError(err instanceof Error ? err.message : "Failed to load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, [roomId, markRoomRead]);

  useEffect(() => {
    fetchRoom();
    fetchMessages();
  }, [fetchRoom, fetchMessages]);

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

      setMessages((prev) => {
        const idToMatch = msg.id || (msg as any)._id;
        if (prev.some((m) => (m.id || (m as any)._id) === idToMatch)) return prev;
        return [...prev, msg];
      });

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
    setSwipingId(msg.id);
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
      if (swipingId === msg.id) {
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

  // ── Load more ───────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0;
    try {
      const result = await getMessages(roomId, 50, nextCursor);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id || (m as any)._id));
        const newMsgs = result.messages.filter((m) => !existingIds.has(m.id || (m as any)._id));
        return [...newMsgs, ...prev];
      });
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
        }
      });
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, roomId]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    if (trimmed.length > 2000) {
      setSendError("Message cannot exceed 2000 characters.");
      return;
    }
    setIsSending(true);
    setSendError("");
    try {
      const replyToId = replyingTo ? replyingTo.id : undefined;
      const msg = await sendMessage(roomId, trimmed, replyToId);
      setMessages((prev) => {
        const idToMatch = msg.id || (msg as any)._id;
        if (prev.some((m) => (m.id || (m as any)._id) === idToMatch)) return prev;
        return [...prev, msg];
      });
      setInputText("");
      setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, roomId, replyingTo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setSendError("");
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleContactRenamed = useCallback(
    (updated: ContactIdentityResponse) => {
      setContactIdentity(updated);
      if (onContactUpdate) {
        onContactUpdate(updated);
      }
    },
    [onContactUpdate]
  );

  // ── Render: room error ──────────────────────────────────────────────────────
  if (!roomLoading && roomError) {
    return (
      <div className="flex flex-col h-full bg-surface">
        {onBack && (
          <header className="flex-shrink-0 border-b border-border bg-surface px-4 py-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </header>
        )}
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-xs space-y-3">
            <p className="text-sm font-semibold text-foreground">{roomError}</p>
            <button
              type="button"
              onClick={fetchRoom}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
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
    <div className="flex flex-col h-full bg-background overflow-hidden min-w-0">
      {/* Header */}
      <header className="h-14 px-4 border-b border-border bg-surface flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
              aria-label="Back to conversations"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDeveloperRoom
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isDeveloperRoom ? <Wrench className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            {roomLoading ? (
              <HeaderSkeleton />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground truncate">{displayName}</span>
                  {isDeveloperRoom ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 uppercase tracking-wider">
                      Developer Chat
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      Private 1-on-1
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {!isDeveloperRoom && isOtherUserOnline && (
                    <span className="flex h-2 w-2 relative flex-shrink-0" title="Online">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                  <p className="text-[11px] text-muted truncate">
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border text-secondary hover:text-foreground hover:bg-elevated transition-colors"
              title="Rename contact locally"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Rename</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchMessages}
            disabled={messagesLoading}
            className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-elevated transition-colors disabled:opacity-50"
            aria-label="Refresh messages"
            title="Refresh messages"
          >
            <RefreshCw className={`w-4 h-4 ${messagesLoading ? "animate-spin" : ""}`} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-elevated transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1.5 z-30 w-48 rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
                {!isDeveloperRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsRenameModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-elevated transition-colors text-left"
                  >
                    <UserPen className="w-3.5 h-3.5 text-blue-500" />
                    <span>Rename Contact</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInfoModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-elevated transition-colors text-left"
                >
                  <Info className="w-3.5 h-3.5 text-secondary" />
                  <span>Anonymous Chat Info</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Thread */}
      <div
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight < 100) {
              setShowNewMessageBanner(false);
            }
          }
        }}
        className="flex-1 min-h-0 overflow-y-auto w-full p-4 sm:p-6 space-y-4"
        aria-label="Conversation messages"
      >
        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-[11px] text-secondary font-semibold hover:bg-elevated transition-colors disabled:opacity-50"
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

        {/* Loading Skeleton */}
        {messagesLoading && <MessageSkeleton />}

        {/* Messages Error */}
        {!messagesLoading && messagesError && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
            <p className="text-xs text-red-500 font-medium">{messagesError}</p>
            <button
              type="button"
              onClick={fetchMessages}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 text-center select-none space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Start the conversation</p>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Send a message to start chatting anonymously in this private thread.
              </p>
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {!messagesLoading &&
          !messagesError &&
          messages.length > 0 &&
          buildMessageList(messages).map((item, listIndex, arr) => {
            if (item.type === "separator") {
              return <DateSeparator key={item.key} label={item.label} />;
            }

            const isMine = item.senderId === clientId;
            const msgKey = item.id || (item as any)._id || `msg-${listIndex}`;

            return (
              <div
                key={msgKey}
                id={`msg-${item.id || (item as any)._id}`}
                onTouchStart={(e) => handleTouchStartMessage(e, item)}
                onTouchMove={(e) => handleTouchMoveMessage(e, item.id)}
                onTouchEnd={(e) => handleTouchEndMessage(e, item)}
                className={`flex w-full ${isMine ? "justify-end" : "justify-start"} ${
                  highlightedMessageId === item.id
                    ? "bg-blue-500/10 py-1.5 rounded-xl px-2 transition-colors duration-500"
                    : ""
                }`}
                style={{
                  transform:
                    swipingId === item.id ? `translateX(${swipeOffset}px)` : "translateX(0px)",
                  transition:
                    swipingId === item.id ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                <div className="relative group max-w-[85%] md:max-w-[70%] flex items-center">
                  <div
                    className={`px-3.5 py-2.5 w-full shadow-xs ${
                      isMine
                        ? "bg-blue-600 text-white rounded-2xl rounded-tr-xs border border-blue-500/30"
                        : "bg-surface border border-border text-foreground rounded-2xl rounded-tl-xs"
                    }`}
                  >
                    {/* Quoted Reply Block */}
                    {item.replyTo && (
                      <div
                        onClick={() => handleScrollToMessage(item.replyTo!.id)}
                        className={`mb-2 cursor-pointer rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition-colors select-none ${
                          isMine
                            ? "bg-blue-700/60 border-l-white text-white/90 hover:bg-blue-700/80"
                            : "bg-black/5 dark:bg-white/5 border-l-blue-500 text-foreground/80 hover:bg-black/10 dark:hover:bg-white/10"
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider font-bold block mb-0.5 opacity-80">
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

                    {/* Message Timestamp */}
                    <div className={`flex justify-end mt-1 ${isMine ? "text-white/80" : "text-muted"}`}>
                      <span className="text-[10px] tabular-nums select-none font-medium">
                        {formatMessageTime(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Reply Action Button */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden md:flex flex-col gap-1 z-10 ${
                      isMine ? "left-[-36px]" : "right-[-36px]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleInitiateReply(item)}
                      className="p-1.5 hover:bg-elevated rounded-full text-secondary hover:text-foreground transition-colors"
                      aria-label="Reply to message"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
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
              className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <span>New messages</span>
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-surface shrink-0">
        {/* Reply Preview Banner */}
        {replyingTo && (
          <div className="border-b border-border bg-surface/70 px-4 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start gap-2.5 min-w-0 border-l-[3px] border-l-blue-500 pl-2.5">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-500">
                  Replying to Message
                </span>
                <p className="text-xs text-foreground/80 line-clamp-1 leading-relaxed">
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

        <div className="p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 min-w-0 relative bg-background rounded-xl border border-border focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
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
                disabled={isSending}
                className="w-full bg-transparent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:outline-none resize-none min-h-[42px] max-h-[120px] overflow-y-auto"
              />
            </div>

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          {sendError && (
            <p className="text-[11px] text-red-500 font-medium mt-1.5 px-1">{sendError}</p>
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
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setActionSheetMsg(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Message actions"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-surface border-t border-border shadow-xl animate-in slide-in-from-bottom-4 duration-200 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex flex-col">
              <div className="flex justify-center py-2">
                <div className="w-8 h-1 rounded-full bg-border" />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleInitiateReply(actionSheetMsg);
                  setActionSheetMsg(null);
                }}
                className="flex items-center gap-3 w-full px-5 py-3.5 text-left text-sm font-medium text-foreground hover:bg-elevated transition-colors"
              >
                <Reply className="w-4 h-4 text-blue-500" />
                <span>Reply</span>
              </button>
              <div className="h-px bg-border mx-5 my-1" />
              <button
                type="button"
                onClick={() => setActionSheetMsg(null)}
                className="flex items-center justify-center w-full px-5 py-3.5 text-sm font-medium text-muted hover:bg-elevated transition-colors"
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
