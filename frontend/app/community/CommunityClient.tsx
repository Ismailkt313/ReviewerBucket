"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";
import { getSocket } from "@/app/utils/socket";
import { useVisualViewport } from "@/app/hooks/useVisualViewport";
import NotificationPanel from "../components/NotificationPanel";
import { useCommunityUnread } from "../hooks/useCommunityUnread";
import { usePrivateUnread } from "../hooks/usePrivateUnread";
import { createOrGetPrivateRoom } from "../services/private-rooms";

const ACCESSIBLE_COLORS = [
  "#a855f7", // Purple
  "#8b5cf6", // Violet
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#f43f5e"  // Rose
];

function getOrGeneratePersistentColor(): string {
  if (typeof window === "undefined") return "#808080";
  let stored = localStorage.getItem("chat_user_color");
  if (!stored || !ACCESSIBLE_COLORS.includes(stored)) {
    const randomColor = ACCESSIBLE_COLORS[Math.floor(Math.random() * ACCESSIBLE_COLORS.length)];
    localStorage.setItem("chat_user_color", randomColor);
    stored = randomColor;
  }
  return stored;
}

type PublicCommunityMessage = {
  id: string;
  _id: string;
  content: string;
  message: string;
  color: string;
  replyTo?: {
    id: string;
    _id: string;
    content: string;
    message: string;
    color: string;
  } | null;
  createdAt: string;
  isMine: boolean;
  /** Present on non-own messages. Used to initiate a private room. */
  anonymousClientId?: string;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

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
      hour12: true
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function CommunityClient() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageIds = useRef<Set<string>>(new Set());
  const scrollTracker = useRef({ lastY: 0, cumulativeUp: 0 });
  const isUserScrollingRef = useRef(false);
  const shouldScrollToBottomRef = useRef(false);

  const [messages, setMessages] = useState<PublicCommunityMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [userColor, setUserColor] = useState<string>("#808080");
  const [replyingTo, setReplyingTo] = useState<PublicCommunityMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Mobile Swipe-to-reply states
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Private chat states
  const { totalUnreadCount: privateUnreadCount } = usePrivateUnread();
  const [privateRoomLoadingId, setPrivateRoomLoadingId] = useState<string | null>(null);
  const [privateRoomError, setPrivateRoomError] = useState<string>("");
  // Mobile long-press action sheet
  const [actionSheetMsg, setActionSheetMsg] = useState<PublicCommunityMessage | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setUserColor(getOrGeneratePersistentColor());
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReplyingTo(null);
        setActionSheetMsg(null);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  const { markCommunityRead } = useCommunityUnread();

  useEffect(() => {
    markCommunityRead();
  }, [markCommunityRead]);

  const handleInitiateReply = useCallback((msg: PublicCommunityMessage) => {
    setActionSheetMsg(null);
    setReplyingTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleMessagePrivately = useCallback(async (msg: PublicCommunityMessage) => {
    setActionSheetMsg(null);
    const targetId = msg.anonymousClientId;
    if (!targetId) return;
    if (privateRoomLoadingId) return;

    setPrivateRoomLoadingId(msg.id);
    setPrivateRoomError("");
    try {
      const room = await createOrGetPrivateRoom(targetId);
      router.push(`/private-chats/${room.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start private chat.";
      setPrivateRoomError(message);
    } finally {
      setPrivateRoomLoadingId(null);
    }
  }, [privateRoomLoadingId, router]);

  const handleScrollToMessage = useCallback((targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(targetId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  }, []);

  const handleTouchStartMessage = useCallback((e: React.TouchEvent, msg: PublicCommunityMessage) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    setSwipingId(msg.id);
    setSwipeOffset(0);

    // Long-press for non-own messages: show action sheet after 500ms
    if (!msg.isMine && msg.anonymousClientId) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        setActionSheetMsg(msg);
        setSwipingId(null);
        setSwipeOffset(0);
      }, 500);
    }
  }, []);

  const handleTouchMoveMessage = useCallback((e: React.TouchEvent, msgId: string) => {
    // Cancel long-press if finger moves
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!touchStartRef.current || swipingId !== msgId) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX > 0) {
      const capped = Math.min(deltaX, 80);
      setSwipeOffset(capped);
    }
  }, [swipingId]);

  const handleTouchEndMessage = useCallback((e: React.TouchEvent, msg: PublicCommunityMessage) => {
    // Cancel long-press timer on touch end
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
  }, [swipingId, swipeOffset, handleInitiateReply]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
      setUnreadCount(0);
    }
  }, []);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesRef = useRef<PublicCommunityMessage[]>(messages);
  messagesRef.current = messages;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;
  const oldScrollHeightRef = useRef<number>(0);

  useVisualViewport();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const currentY = el.scrollTop;
      const tracker = scrollTracker.current;
      const delta = currentY - tracker.lastY;

      // Trigger scroll-to-top older message chunk loading (WhatsApp style)
      if (
        currentY <= 40 &&
        hasMoreRef.current &&
        !isLoadingMoreRef.current &&
        messagesRef.current.length > 0
      ) {
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        oldScrollHeightRef.current = el.scrollHeight;

        const oldestId = messagesRef.current[0].id;
        socketRef.current?.emit("community:history:more", { beforeId: oldestId });
      }

      if (delta < 0 && isUserScrollingRef.current) {
        tracker.cumulativeUp += Math.abs(delta);

        if (
          tracker.cumulativeUp >= 30 &&
          textareaRef.current &&
          document.activeElement === textareaRef.current
        ) {
          const savedScrollTop = el.scrollTop;
          textareaRef.current.blur();
          requestAnimationFrame(() => {
            el.scrollTop = savedScrollTop;
          });
          tracker.cumulativeUp = 0;
        }
      } else {
        tracker.cumulativeUp = 0;
      }

      tracker.lastY = currentY;
    };

    const handleTouchStart = () => {
      isUserScrollingRef.current = true;
    };

    const handleTouchEnd = () => {
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 800);
    };

    const handleWheel = () => {
      isUserScrollingRef.current = true;
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 800);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      isUserScrollingRef.current = false;
      scrollToBottom("smooth");
      shouldScrollToBottomRef.current = false;
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setStatus("connected");
      setError("");
      socket.emit("community:history:request");
      socket.emit("community:online-count:request");
      socket.emit("community:page:join");
    };

    const handleDisconnect = () => {
      setStatus("disconnected");
      setOnlineCount(0);
    };

    const handleConnectError = () => {
      setStatus("reconnecting");
    };

    const handleOnlineCount = (data: { count: number }) => {
      setOnlineCount(data.count);
    };

    const handleHistory = (data: { messages: PublicCommunityMessage[]; hasMore?: boolean }) => {
      setMessages(data.messages);
      setHasMore(data.hasMore ?? true);
      setTimeout(() => {
        scrollToBottom("instant");
      }, 50);
    };

    const handleHistoryMore = (data: { messages: PublicCommunityMessage[]; hasMore: boolean }) => {
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = data.messages.filter((m) => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });

        requestAnimationFrame(() => {
          if (scrollRef.current && oldScrollHeightRef.current > 0) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = newScrollHeight - oldScrollHeightRef.current;
            oldScrollHeightRef.current = 0;
          }
        });
      }

      setHasMore(data.hasMore);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    };

    const handleMessageNew = (message: PublicCommunityMessage) => {
      if (pendingMessageIds.current.has(message.id)) {
        pendingMessageIds.current.delete(message.id);
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });

      if (message.isMine) {
        setTimeout(() => {
          scrollToBottom("smooth");
          setUnreadCount(0);
        }, 50);
      } else {
        setTimeout(() => {
          if (isNearBottom()) {
            scrollToBottom("smooth");
          } else {
            setUnreadCount((count) => count + 1);
          }
        }, 50);
      }
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    };

    // Register ALL listeners BEFORE any emits to prevent race conditions.
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("community:online-count", handleOnlineCount);
    socket.on("community:history", handleHistory);
    socket.on("community:history:more:response", handleHistoryMore);
    socket.on("community:message:new", handleMessageNew);
    socket.on("community:error", handleError);

    // If socket is already connected (e.g. navigated from another page),
    // explicitly request history and online count since "connect" won't fire again.
    if (socket.connected) {
      setStatus("connected");
      setError("");
      socket.emit("community:history:request");
      socket.emit("community:online-count:request");
      socket.emit("community:page:join");
    }

    return () => {
      socket.emit("community:page:leave");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("community:online-count", handleOnlineCount);
      socket.off("community:history", handleHistory);
      socket.off("community:history:more:response", handleHistoryMore);
      socket.off("community:message:new", handleMessageNew);
      socket.off("community:error", handleError);
    };
  }, [scrollToBottom, isNearBottom]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSubmit = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    const socket = socketRef.current;
    if (!socket || isSubmitting) return;

    const trimmed = inputText.trim();
    if (trimmed.length < 2) {
      setError("Please write at least 2 characters.");
      return;
    }

    if (trimmed.length > 500) {
      setError("Message cannot exceed 500 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    socket.emit("community:message:send", {
      content: trimmed,
      message: trimmed,
      color: userColor,
      replyTo: replyingTo ? replyingTo.id : null
    }, (ack: { success: boolean; message?: string; messageId?: string }) => {
      setIsSubmitting(false);
      if (ack && ack.success) {
        if (ack.messageId) {
          pendingMessageIds.current.add(ack.messageId);
          const newMessage: PublicCommunityMessage = {
            id: ack.messageId,
            _id: ack.messageId,
            content: trimmed,
            message: trimmed,
            color: userColor,
            replyTo: replyingTo ? {
              id: replyingTo.id,
              _id: replyingTo.id,
              content: replyingTo.content,
              message: replyingTo.content,
              color: replyingTo.color
            } : null,
            createdAt: new Date().toISOString(),
            isMine: true
          };
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === ack.messageId);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
        setInputText("");
        setReplyingTo(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.focus();
        }
        shouldScrollToBottomRef.current = true;
        setUnreadCount(0);
      } else {
        setError(ack?.message || "Could not submit message. Please try again.");
      }
    });
  }, [inputText, isSubmitting, userColor, replyingTo]);

  const handleSendMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  const handleSendTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <div
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground animate-in fade-in duration-200"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))"
      }}
    >
      <header className="relative z-50 flex-shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs">
        <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex h-14 items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-secondary flex items-center justify-center min-w-[44px] min-h-[44px]"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight">Community Feed</h1>
            </div>
            <div className="flex items-center gap-2">
              {status === "connected" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} online
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
                  {status === "connecting" && "Connecting..."}
                  {status === "reconnecting" && "Reconnecting..."}
                  {status === "disconnected" && "Disconnected"}
                </span>
              )}
              {/* Private Chats navigation entry point */}
              <button
                type="button"
                onClick={() => router.push("/private-chats")}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus min-w-[36px] min-h-[36px]"
                aria-label={`Private Chats${privateUnreadCount > 0 ? ` (${privateUnreadCount} unread)` : ""}`}
                title="Private Chats"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {privateUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-background ring-2 ring-background animate-pulse">
                    {privateUnreadCount > 9 ? "9+" : privateUnreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto w-full scroll-smooth"
        >
          <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8 py-3 flex flex-col gap-1.5 min-h-full">
            {isLoadingMore && (
              <div className="flex justify-center py-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] text-secondary font-medium shadow-xs">
                  <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" />
                  <span>Loading older messages...</span>
                </div>
              </div>
            )}
            {messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  onTouchStart={(e) => handleTouchStartMessage(e, msg)}
                  onTouchMove={(e) => handleTouchMoveMessage(e, msg.id)}
                  onTouchEnd={(e) => handleTouchEndMessage(e, msg)}
                  className={`flex w-full transition-all duration-500 ${
                    msg.isMine ? "justify-end" : "justify-start"
                  } ${highlightedMessageId === msg.id ? "bg-neutral-100 dark:bg-neutral-800/60 py-1.5 rounded-xl px-2" : ""}`}
                  style={{
                    transform: swipingId === msg.id ? `translateX(${swipeOffset}px)` : "translateX(0px)",
                    transition: swipingId === msg.id ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"
                  }}
                >
                  <div className="relative group max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex items-center">
                    <div
                      className={`px-3.5 py-2 w-full ${
                        msg.isMine
                          ? "rounded-2xl rounded-br-sm bg-bubble-mine text-bubble-mine-text"
                          : "rounded-2xl rounded-bl-sm bg-bubble-other text-bubble-other-text"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!msg.isMine && (
                          <span
                            className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: msg.color || "#808080" }}
                            title="Anonymous user color identity"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          {msg.replyTo && (
                            <div
                              onClick={() => handleScrollToMessage(msg.replyTo!.id)}
                              className="mb-1.5 cursor-pointer rounded-lg bg-black/5 dark:bg-white/5 border-l-[3px] px-2.5 py-1 text-left hover:bg-black/10 dark:hover:bg-white/10 transition-colors select-none"
                              style={{ borderColor: msg.replyTo.color }}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: msg.replyTo.color }} />
                                <span className="text-[9px] uppercase tracking-wider font-bold text-secondary">Reply</span>
                              </div>
                              <p className="text-[11px] leading-snug text-foreground/70 line-clamp-1 select-none">
                                {msg.replyTo.content}
                              </p>
                            </div>
                          )}
                          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] overflow-wrap-anywhere">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                      <div className={`flex justify-end mt-0.5 ${msg.isMine ? "opacity-60" : "opacity-50"}`}>
                        <span className="text-[10px] leading-none">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop hover actions: reply + message privately */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 hidden md:flex flex-col gap-1 z-10 ${
                        msg.isMine ? "left-[-44px]" : "right-[-44px]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleInitiateReply(msg)}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-secondary flex items-center justify-center min-w-[32px] min-h-[32px]"
                        aria-label="Reply to message"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M9 10L4 15L9 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M20 4V11C20 12.0609 19.5786 13.0783 18.8284 13.8284C18.0783 14.5786 17.0609 15 16 15H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {!msg.isMine && msg.anonymousClientId && (
                        <button
                          type="button"
                          onClick={() => handleMessagePrivately(msg)}
                          disabled={privateRoomLoadingId === msg.id}
                          className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-secondary flex items-center justify-center min-w-[32px] min-h-[32px] disabled:opacity-40"
                          aria-label="Message privately"
                          title="Message privately"
                        >
                          {privateRoomLoadingId === msg.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" aria-hidden="true" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="my-auto py-12 text-center">
                {status === "connecting" ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-secondary">Loading messages...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
                      <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-sm text-secondary">No messages yet</p>
                    <p className="text-xs text-muted">Be the first to say something about reviews or assessments</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-accent text-background text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg hover:opacity-90 transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 z-10"
            >
              ↓ {unreadCount} new
            </button>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-border bg-surface w-full">
          {/* Reply Preview */}
          {replyingTo && (
            <div className="w-full border-b border-border bg-surface/50">
              <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-start gap-2.5 min-w-0 border-l-[3px] pl-3" style={{ borderColor: replyingTo.color }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: replyingTo.color }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary">Replying to</span>
                    <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed break-words">
                      {replyingTo.content}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="flex-shrink-0 p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-secondary transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Cancel reply"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor="community-input" className="sr-only">
                  Message the community
                </label>
                <textarea
                  ref={textareaRef}
                  id="community-input"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  maxLength={500}
                  rows={1}
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-[16px] sm:text-sm text-foreground focus:border-neutral-400 focus:ring-2 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500 resize-none transition-colors duration-150 block min-h-[38px] max-h-[120px] overflow-y-auto"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || status !== "connected"}
                onMouseDown={handleSendMouseDown}
                onTouchStart={handleSendTouchStart}
                className="flex-shrink-0 w-[38px] h-[38px] rounded-full bg-accent text-background flex items-center justify-center hover:opacity-90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-40"
                aria-label="Send message"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </form>
            {error && (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1 px-1">{error}</p>
            )}
            {privateRoomError && (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-1 px-1" role="alert">
                {privateRoomError}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Mobile long-press action sheet */}
      {actionSheetMsg && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setActionSheetMsg(null)}
            aria-hidden="true"
          />
          {/* Sheet */}
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
                onClick={() => handleInitiateReply(actionSheetMsg)}
                className="flex items-center gap-3 w-full px-5 py-3.5 text-left text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M9 10L4 15L9 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 4V11C20 12.0609 19.5786 13.0783 18.8284 13.8284C18.0783 14.5786 17.0609 15 16 15H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Reply
              </button>
              {actionSheetMsg.anonymousClientId && (
                <button
                  type="button"
                  disabled={!!privateRoomLoadingId}
                  onClick={() => handleMessagePrivately(actionSheetMsg)}
                  className="flex items-center gap-3 w-full px-5 py-3.5 text-left text-sm font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  {privateRoomLoadingId ? (
                    <div className="w-4.5 h-4.5 border-2 border-border border-t-accent rounded-full animate-spin" aria-hidden="true" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                  Message privately
                </button>
              )}
              <div className="h-px bg-border mx-5 my-1" />
              <button
                type="button"
                onClick={() => setActionSheetMsg(null)}
                className="flex items-center justify-center w-full px-5 py-3.5 text-sm font-medium text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
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
