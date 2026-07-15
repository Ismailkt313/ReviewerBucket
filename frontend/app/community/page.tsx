"use client";

import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import Header from "../components/Header";

type PublicCommunityMessage = {
  id: string;
  content: string;
  createdAt: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<PublicCommunityMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
      setUnreadCount(0);
    }
  };

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--visual-viewport-height", `${height}px`);
    };

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const socket = io(`${socketUrl}/community`, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Successful socket connection");
      setStatus("connected");
      setError("");
      socket.emit("community:history:request");
    });

    socket.on("disconnect", (reason) => {
      console.log("disconnect reason:", reason);
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.log("connect_error message:", err.message);
      setStatus("reconnecting");
    });

    socket.on("community:online-count", (data: { count: number }) => {
      setOnlineCount(data.count);
    });

    socket.on("community:history", (data: { messages: PublicCommunityMessage[] }) => {
      setMessages(data.messages);
      setTimeout(() => {
        scrollToBottom("instant");
      }, 50);
    });

    socket.on("community:message:new", (message: PublicCommunityMessage) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });

      setTimeout(() => {
        if (isNearBottom()) {
          scrollToBottom("smooth");
        } else {
          setUnreadCount((count) => count + 1);
        }
      }, 50);
    });

    socket.on("community:error", (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
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

    socket.emit("community:message:send", { content: trimmed }, (ack: { success: boolean; message?: string }) => {
      setIsSubmitting(false);
      if (ack && ack.success) {
        setInputText("");
        setTimeout(() => {
          scrollToBottom("smooth");
        }, 50);
      } else {
        setError(ack?.message || "Could not submit message. Please try again.");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <div
        className="flex flex-col overflow-hidden bg-background text-foreground"
        style={{ height: "var(--visual-viewport-height, 100dvh)" }}
      >
        <Header />

        <main className="flex-1 min-h-0 flex flex-col">
          <div className="mx-auto w-full max-w-3xl flex-1 min-h-0 flex flex-col px-4 py-3">
            <div className="flex-shrink-0 flex items-center justify-between border-b border-border pb-3 mb-3">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  Community
                </h1>
                <p className="text-xs text-secondary mt-0.5">
                  Anonymous community chat
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-secondary">
                  {onlineCount} online
                </span>
                {status !== "connected" && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
                    {status === "connecting" && "Connecting..."}
                    {status === "reconnecting" && "Reconnecting..."}
                    {status === "disconnected" && "Disconnected"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 border border-border bg-surface rounded-xl flex flex-col overflow-hidden relative">
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3 scroll-smooth"
              >
                {messages.length > 0 ? (
                  messages.map((msg, idx) => (
                    <div key={msg.id} className="flex flex-col gap-0.5">
                      {idx > 0 && <div className="border-t border-border/40 my-2" />}
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm leading-relaxed text-secondary whitespace-pre-line break-words overflow-wrap break-all">
                          {msg.content}
                        </p>
                        <div className="flex justify-end text-[9px] text-muted font-medium mt-0.5">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="my-auto py-12 text-center text-sm text-secondary">
                    {status === "connecting" ? "Loading history..." : "No messages in the community yet."}
                  </div>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToBottom("smooth")}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-accent text-background text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-accent hover:opacity-90 transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 z-10"
                >
                  <span>↓ {unreadCount} new {unreadCount === 1 ? "message" : "messages"}</span>
                </button>
              )}

              <div className="flex-shrink-0 border-t border-border bg-background p-3 pb-3 sm:pb-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  <div className="flex gap-2 items-end">
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
                        placeholder="Message the community..."
                        maxLength={500}
                        rows={1}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base sm:text-sm text-foreground focus:border-neutral-400 focus:ring-2 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500 resize-none transition-colors duration-150 block min-h-[38px] max-h-[120px] overflow-y-auto"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || status !== "connected"}
                      className="flex-shrink-0 h-[38px] px-4 rounded-lg bg-accent text-background text-xs font-bold border border-accent hover:opacity-90 transition-opacity duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {isSubmitting ? "..." : "Send"}
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
