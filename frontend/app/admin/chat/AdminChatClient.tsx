"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminPrivateRoom,
  AdminPrivateMessage,
  getAdminPrivateRooms,
  getAdminPrivateMessages,
  sendAdminPrivateMessage,
  setAdminRoomLabel,
  formatAdminUserDisplayId,
} from "@/app/services/admin-chat";
import { getSocket } from "@/app/utils/socket";
import AdminShell from "@/app/admin/components/AdminShell";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import {
  MessageSquare,
  Search,
  Send,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  User,
  ShieldCheck,
  Clock,
  Reply,
  X,
  Pencil,
  Check,
  Megaphone,
} from "lucide-react";

export interface AdminChatClientProps {
  selectedRoomId?: string;
}

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

export default function AdminChatClient({ selectedRoomId }: AdminChatClientProps) {
  const router = useRouter();

  // State
  const [rooms, setRooms] = useState<AdminPrivateRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRoomsLoading, setIsRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [activeRoom, setActiveRoom] = useState<AdminPrivateRoom | null>(null);
  const [messages, setMessages] = useState<AdminPrivateMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [inputContent, setInputContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Admin Label Modal state
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<AdminPrivateMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Mobile Swipe-to-reply states
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll helper
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Escape key listener to clear reply or close modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReplyingTo(null);
        setIsLabelModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Dynamic textarea height calculation
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [inputContent]);

  // Reply handlers
  const handleInitiateReply = useCallback((msg: AdminPrivateMessage) => {
    setReplyingTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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

  // Touch handlers for mobile swipe-to-reply
  const handleTouchStartMessage = useCallback((e: React.TouchEvent, msg: AdminPrivateMessage) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    setSwipingId(msg.id);
    setSwipeOffset(0);
  }, []);

  const handleTouchMoveMessage = useCallback((e: React.TouchEvent, msgId: string) => {
    if (!touchStartRef.current || swipingId !== msgId) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX > 0) {
      const capped = Math.min(deltaX, 80);
      setSwipeOffset(capped);
    }
  }, [swipingId]);

  const handleTouchEndMessage = useCallback((e: React.TouchEvent, msg: AdminPrivateMessage) => {
    if (swipingId === msg.id) {
      if (swipeOffset >= 50) {
        handleInitiateReply(msg);
      }
      setSwipingId(null);
      setSwipeOffset(0);
    }
    touchStartRef.current = null;
  }, [swipingId, swipeOffset, handleInitiateReply]);

  // 1. Fetch developer rooms list
  const fetchRooms = useCallback(async () => {
    setIsRoomsLoading(true);
    setRoomsError(null);
    try {
      const data = await getAdminPrivateRooms();
      setRooms(data);
    } catch (err: unknown) {
      setRoomsError(err instanceof Error ? err.message : "Failed to load conversations.");
    } finally {
      setIsRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 2. Fetch messages when selectedRoomId changes
  const fetchMessages = useCallback(async (roomId: string) => {
    setIsMessagesLoading(true);
    setMessagesError(null);
    setReplyingTo(null);
    try {
      const data = await getAdminPrivateMessages(roomId);
      setMessages(data.messages || []);
      setTimeout(() => scrollToBottom(false), 50);
    } catch (err: unknown) {
      setMessagesError(err instanceof Error ? err.message : "Failed to load messages.");
    } finally {
      setIsMessagesLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (selectedRoomId) {
      const matched = rooms.find((r) => r.id === selectedRoomId);
      if (matched) setActiveRoom(matched);
      fetchMessages(selectedRoomId);
    } else {
      setActiveRoom(null);
      setMessages([]);
    }
  }, [selectedRoomId, rooms, fetchMessages]);

  // 3. Socket.IO Real-time Connection for active room
  useEffect(() => {
    if (!selectedRoomId) return;

    const socket = getSocket();

    const joinRoom = () => {
      socket.emit("join:private-room", { roomId: selectedRoomId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on("connect", joinRoom);
    }

    const handleNewMessage = (msg: AdminPrivateMessage & { roomId?: string }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => scrollToBottom(true), 50);

      // Update room lastMessage in sidebar list
      setRooms((prev) =>
        prev.map((r) =>
          r.id === (msg.roomId || selectedRoomId)
            ? {
                ...r,
                lastMessage: {
                  id: msg.id,
                  senderId: msg.senderId,
                  content: msg.content,
                  createdAt: msg.createdAt,
                },
                updatedAt: msg.createdAt,
              }
            : r
        )
      );
    };

    socket.on("private:message:new", handleNewMessage);

    return () => {
      socket.emit("leave:private-room", { roomId: selectedRoomId });
      socket.off("connect", joinRoom);
      socket.off("private:message:new", handleNewMessage);
    };
  }, [selectedRoomId, scrollToBottom]);

  // 4. Send message handler (Socket.IO with REST fallback)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content || !selectedRoomId || isSending) return;

    setIsSending(true);
    setSendError(null);
    const replyToId = replyingTo ? replyingTo.id : undefined;

    const socket = getSocket();

    if (socket && socket.connected) {
      socket.emit(
        "private:message:send",
        { roomId: selectedRoomId, content, replyTo: replyToId },
        (res?: { success: boolean; message?: AdminPrivateMessage; error?: string }) => {
          setIsSending(false);
          if (res?.success && res.message) {
            const newMsg = res.message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setInputContent("");
            setReplyingTo(null);
            if (textareaRef.current) textareaRef.current.style.height = "auto";
            setTimeout(() => scrollToBottom(true), 50);

            setRooms((prev) =>
              prev.map((r) =>
                r.id === selectedRoomId
                  ? {
                      ...r,
                      lastMessage: {
                        id: newMsg.id,
                        senderId: "admin",
                        content: newMsg.content,
                        createdAt: newMsg.createdAt,
                      },
                      updatedAt: newMsg.createdAt,
                    }
                  : r
              )
            );
          } else {
            // Socket error or rejected, fallback to REST
            sendAdminPrivateMessage(selectedRoomId, content, replyToId)
              .then((newMsg) => {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setInputContent("");
                setReplyingTo(null);
                if (textareaRef.current) textareaRef.current.style.height = "auto";
                setTimeout(() => scrollToBottom(true), 50);
              })
              .catch((err) => {
                setSendError(err instanceof Error ? err.message : "Failed to send message.");
              });
          }
        }
      );
    } else {
      try {
        const newMsg = await sendAdminPrivateMessage(selectedRoomId, content, replyToId);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setInputContent("");
        setReplyingTo(null);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setTimeout(() => scrollToBottom(true), 50);
      } catch (err: unknown) {
        setSendError(err instanceof Error ? err.message : "Failed to send message.");
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 5. Admin Room Label handlers
  const handleOpenLabelModal = () => {
    if (!activeRoom) return;
    setLabelInput(activeRoom.adminLabel || "");
    setLabelError(null);
    setIsLabelModalOpen(true);
  };

  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || isSavingLabel) return;

    setIsSavingLabel(true);
    setLabelError(null);

    try {
      const res = await setAdminRoomLabel(selectedRoomId, labelInput);
      const newLabel = res.label || undefined;

      setActiveRoom((prev) => (prev ? { ...prev, adminLabel: newLabel } : null));
      setRooms((prev) =>
        prev.map((r) => (r.id === selectedRoomId ? { ...r, adminLabel: newLabel } : r))
      );
      setIsLabelModalOpen(false);
    } catch (err: unknown) {
      setLabelError(err instanceof Error ? err.message : "Failed to save conversation label.");
    } finally {
      setIsSavingLabel(false);
    }
  };

  // Filter conversations
  const filteredRooms = rooms.filter((r) => {
    const displayId = formatAdminUserDisplayId(r.anonymousDisplayId || r.anonymousUserId).toLowerCase();
    const label = r.adminLabel?.toLowerCase() || "";
    const lastContent = r.lastMessage?.content?.toLowerCase() || "";
    const query = searchQuery.toLowerCase().trim();
    return displayId.includes(query) || label.includes(query) || lastContent.includes(query);
  });

  const getAnonymousLabel = (room: AdminPrivateRoom) => {
    return formatAdminUserDisplayId(room.anonymousDisplayId || room.anonymousUserId);
  };

  return (
    <AdminShell headerTitle="Private Chats">
      <AdminPageHeader
        title="Private Chats"
        description="Direct communication workspace for developer inquiries and support."
      />

      {/* Main 2-Column Chat Container */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex h-[calc(100vh-14rem)] min-h-[500px]">
        {/* LEFT COLUMN: Conversation List */}
        <div
          className={`w-full lg:w-80 border-r border-border flex flex-col bg-surface shrink-0 ${
            selectedRoomId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* List Search Header */}
          <div className="p-3.5 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search user# or label..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quick Context Switcher to Broadcast */}
          <div className="px-3.5 py-2 border-b border-border bg-surface/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              Private Chats
            </span>
            <Link
              href="/admin/broadcast"
              className="text-[11px] font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <Megaphone className="w-3 h-3" />
              <span>Broadcast</span>
            </Link>
          </div>

          {/* List Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isRoomsLoading ? (
              <div className="p-6 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                <p className="text-xs text-muted">Loading developer chats...</p>
              </div>
            ) : roomsError ? (
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                <p className="text-xs text-muted">{roomsError}</p>
                <button
                  onClick={fetchRooms}
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
                  Messages from anonymous community members will appear here.
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const displayId = getAnonymousLabel(room);
                return (
                  <Link
                    key={room.id}
                    href={`/admin/chat/${room.id}`}
                    className={`block p-4 transition-colors relative ${
                      isSelected
                        ? "bg-elevated border-l-4 border-l-blue-500"
                        : "hover:bg-elevated/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {room.adminLabel ? (
                            <div>
                              <p className="text-xs font-bold text-foreground truncate leading-tight">
                                {room.adminLabel}
                              </p>
                              <p className="font-mono text-[10px] text-muted truncate leading-none mt-0.5">
                                {displayId}
                              </p>
                            </div>
                          ) : (
                            <span className="font-mono text-xs font-bold text-foreground truncate block">
                              {displayId}
                            </span>
                          )}
                        </div>
                      </div>
                      {room.lastMessage?.createdAt && (
                        <span className="text-[10px] text-muted shrink-0">
                          {formatMessageTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {room.lastMessage?.content ? (
                      <p className="text-xs text-secondary truncate pl-8">
                        {room.lastMessage.senderId === "admin" ? "You: " : ""}
                        {room.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted italic pl-8">
                        No messages yet
                      </p>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Conversation Workspace */}
        <div
          className={`flex-1 flex flex-col bg-background min-w-0 ${
            !selectedRoomId ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedRoomId && activeRoom ? (
            <>
              {/* Conversation Header */}
              <div className="h-14 px-4 border-b border-border bg-surface flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => router.push("/admin/chat")}
                    className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-elevated lg:hidden"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {activeRoom.adminLabel || getAnonymousLabel(activeRoom)}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                        Developer Chat
                      </span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      {activeRoom.adminLabel
                        ? `${getAnonymousLabel(activeRoom)} • Anonymous Member`
                        : "Anonymous Community Member"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenLabelModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border text-secondary hover:text-foreground hover:bg-elevated transition-colors"
                    title="Rename conversation label"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden sm:inline">Rename</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fetchMessages(selectedRoomId)}
                    disabled={isMessagesLoading}
                    className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-elevated transition-colors disabled:opacity-50"
                    aria-label="Refresh messages"
                    title="Refresh messages"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isMessagesLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Message History Thread - Matching User Community Chat UI */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
                {isMessagesLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-xs text-muted">Loading messages...</p>
                  </div>
                ) : messagesError ? (
                  <div className="p-6 text-center border border-red-800/30 rounded-2xl bg-red-950/20 max-w-sm mx-auto space-y-3">
                    <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                    <p className="text-xs text-muted">{messagesError}</p>
                    <button
                      onClick={() => fetchMessages(selectedRoomId)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg"
                    >
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-muted space-y-2">
                    <Clock className="w-8 h-8 text-muted/50 mx-auto" />
                    <p className="text-xs font-medium">No message history available.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isAdmin = msg.senderId === "admin";
                    const msgKey = msg.id || (msg as any)._id || `msg-${index}`;
                    return (
                      <div
                        key={msgKey}
                        id={`msg-${msg.id || (msg as any)._id}`}
                        onTouchStart={(e) => handleTouchStartMessage(e, msg)}
                        onTouchMove={(e) => handleTouchMoveMessage(e, msg.id)}
                        onTouchEnd={(e) => handleTouchEndMessage(e, msg)}
                        className={`flex w-full transition-all duration-500 ${
                          isAdmin ? "justify-end" : "justify-start"
                        } ${
                          highlightedMessageId === msg.id
                            ? "bg-blue-500/10 py-1.5 rounded-xl px-2"
                            : ""
                        }`}
                        style={{
                          transform:
                            swipingId === msg.id ? `translateX(${swipeOffset}px)` : "translateX(0px)",
                          transition:
                            swipingId === msg.id
                              ? "none"
                              : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
                        }}
                      >
                        <div className="relative group max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex items-center">
                          {/* Bubble Container */}
                          <div
                            className={`px-3.5 py-2 w-full ${
                              isAdmin
                                ? "rounded-2xl rounded-br-sm bg-bubble-mine text-bubble-mine-text"
                                : "rounded-2xl rounded-bl-sm bg-bubble-other text-bubble-other-text border border-border/50"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!isAdmin && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 bg-blue-500"
                                  title={activeRoom.adminLabel || getAnonymousLabel(activeRoom)}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                {/* Quoted Reply Block */}
                                {msg.replyTo && (
                                  <div
                                    onClick={() => handleScrollToMessage(msg.replyTo!.id)}
                                    className="mb-1.5 cursor-pointer rounded-lg bg-black/5 dark:bg-white/5 border-l-[3px] border-l-blue-500 px-2.5 py-1 text-left hover:bg-black/10 dark:hover:bg-white/10 transition-colors select-none"
                                  >
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="w-1 h-1 rounded-full bg-blue-500" />
                                      <span className="text-[9px] uppercase tracking-wider font-bold text-secondary">
                                        Reply
                                      </span>
                                    </div>
                                    <p className="text-[11px] leading-snug text-foreground/70 line-clamp-1 select-none">
                                      {msg.replyTo.content}
                                    </p>
                                  </div>
                                )}

                                {/* Message Content */}
                                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] overflow-wrap-anywhere">
                                  {msg.content}
                                </p>
                              </div>
                            </div>

                            {/* Timestamp (Bottom Right corner of bubble - matching Community Chat UI) */}
                            <div className={`flex justify-end mt-0.5 ${isAdmin ? "opacity-70" : "opacity-50"}`}>
                              <span className="text-[10px] leading-none">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Desktop Hover Action: Reply button */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 hidden md:flex flex-col gap-1 z-10 ${
                              isAdmin ? "left-[-40px]" : "right-[-40px]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleInitiateReply(msg)}
                              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-secondary hover:text-foreground flex items-center justify-center min-w-[32px] min-h-[32px] transition-colors"
                              aria-label="Reply to message"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer & Reply Bar */}
              <div className="flex-shrink-0 border-t border-border bg-surface w-full">
                {/* Reply Preview Banner */}
                {replyingTo && (
                  <div className="w-full border-b border-border bg-surface/50">
                    <div className="px-4 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150">
                      <div className="flex items-start gap-2.5 min-w-0 border-l-[3px] border-l-blue-500 pl-3">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-blue-500" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary">
                            Replying to {replyingTo.senderId === "admin" ? "Admin" : (activeRoom.adminLabel || getAnonymousLabel(activeRoom))}
                          </span>
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
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3 sm:p-4">
                  {sendError && (
                    <div className="mb-2 text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800/40">
                      {sendError}
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                    <div className="flex-1 min-w-0">
                      <label htmlFor="admin-chat-input" className="sr-only">
                        Message user
                      </label>
                      <textarea
                        ref={textareaRef}
                        id="admin-chat-input"
                        rows={1}
                        placeholder={`Reply to ${activeRoom.adminLabel || getAnonymousLabel(activeRoom)}...`}
                        value={inputContent}
                        onChange={(e) => {
                          setInputContent(e.target.value);
                          setSendError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        disabled={isSending}
                        maxLength={2000}
                        className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-[16px] sm:text-xs text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none resize-none transition-colors duration-150 block min-h-[38px] max-h-[120px] overflow-y-auto"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!inputContent.trim() || isSending}
                      className="flex-shrink-0 w-[38px] h-[38px] rounded-full bg-accent text-background flex items-center justify-center hover:opacity-90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : (
            /* Desktop Empty Selected Room View */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted space-y-3">
              <div className="p-4 rounded-2xl bg-surface border border-border text-blue-500">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Private Chats Workspace</h3>
              <p className="text-xs text-muted max-w-sm">
                Select a developer conversation from the sidebar list to view message history and send replies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Conversation Label Modal */}
      {isLabelModalOpen && activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" />
                <span>Rename Conversation Label</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLabelModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-elevated transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Set an administrative display label (e.g. <code className="text-accent">React Issue Reporter</code>) for this conversation. This label is strictly private to admins and does not affect the anonymous user's view.
            </p>

            <form onSubmit={handleSaveLabel} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-secondary uppercase tracking-wider mb-1.5">
                  Conversation Label
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder={`Default: ${getAnonymousLabel(activeRoom)}`}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {labelError && (
                <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-400">
                  {labelError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLabelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-secondary hover:bg-elevated hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLabel}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                >
                  {isSavingLabel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Label</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
