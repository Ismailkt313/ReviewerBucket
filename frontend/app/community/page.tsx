"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";
import { getSocket } from "@/app/utils/socket";
import { useVisualViewport } from "@/app/hooks/useVisualViewport";

type PublicCommunityMessage = {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
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

export default function CommunityPage() {
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

  const socketRef = useRef<Socket | null>(null);

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

  useVisualViewport();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const currentY = el.scrollTop;
      const tracker = scrollTracker.current;
      const delta = currentY - tracker.lastY;

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

    if (socket.connected) {
      setTimeout(() => {
        setStatus("connected");
        setError("");
      }, 0);
      socket.emit("community:history:request");
    }

    const handleConnect = () => {
      setStatus("connected");
      setError("");
      socket.emit("community:history:request");
    };

    const handleDisconnect = () => {
      setStatus("disconnected");
    };

    const handleConnectError = () => {
      setStatus("reconnecting");
    };

    const handleOnlineCount = (data: { count: number }) => {
      setOnlineCount(data.count);
    };

    const handleHistory = (data: { messages: PublicCommunityMessage[] }) => {
      setMessages(data.messages);
      setTimeout(() => {
        scrollToBottom("instant");
      }, 50);
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
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("community:online-count", handleOnlineCount);
    socket.on("community:history", handleHistory);
    socket.on("community:message:new", handleMessageNew);
    socket.on("community:error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("community:online-count", handleOnlineCount);
      socket.off("community:history", handleHistory);
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

    socket.emit("community:message:send", { content: trimmed }, (ack: { success: boolean; message?: string; messageId?: string }) => {
      setIsSubmitting(false);
      if (ack && ack.success) {
        if (ack.messageId) {
          pendingMessageIds.current.add(ack.messageId);
          const newMessage: PublicCommunityMessage = {
            id: ack.messageId,
            content: trimmed,
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
  }, [inputText, isSubmitting]);

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
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))"
      }}
    >
      <header className="flex-shrink-0 border-b border-border bg-surface/95 backdrop-blur-xs">
        <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex h-14 items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight">Community</h1>
            </div>
            <div className="flex items-center gap-1.5">
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
            {messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full ${msg.isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] px-3.5 py-2 ${
                      msg.isMine
                        ? "ml-auto rounded-2xl rounded-br-sm bg-bubble-mine text-bubble-mine-text"
                        : "mr-auto rounded-2xl rounded-bl-sm bg-bubble-other text-bubble-other-text"
                    }`}
                  >
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] overflow-wrap-anywhere">
                      {msg.content}
                    </p>
                    <div className={`flex justify-end mt-0.5 ${msg.isMine ? "opacity-60" : "opacity-50"}`}>
                      <span className="text-[10px] leading-none">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="my-auto py-12 text-center">
                {status === "connecting" ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-secondary">Loading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
                      <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-sm text-secondary">No messages yet</p>
                    <p className="text-xs text-muted">Be the first to say something</p>
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
          </div>
        </div>
      </main>
    </div>
  );
}
