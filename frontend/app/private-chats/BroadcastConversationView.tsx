"use client";

import { useEffect, useRef, useState, useCallback, JSX } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, ArrowLeft, MoreVertical, Info, Wrench, Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { IPublicBroadcast, getUserBroadcasts } from "@/app/services/broadcasts";
import { createOrGetDeveloperRoom } from "@/app/services/private-rooms";
import { getSocket } from "@/app/utils/socket";
import { useBroadcastUnread } from "../hooks/useBroadcastUnread";
import AnonymousInfoModal from "./AnonymousInfoModal";

export interface BroadcastConversationViewProps {
  onBack?: () => void;
}

function formatAnnouncementTime(dateString: string): string {
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

function AnnouncementSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 animate-pulse" aria-hidden="true">
      <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 space-y-2.5 max-w-lg">
        <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded w-32" />
        <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded w-full" />
        <div className="h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
      </div>
      <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 space-y-2.5 max-w-lg">
        <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded w-28" />
        <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
        <div className="h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
      </div>
    </div>
  );
}

export default function BroadcastConversationView({
  onBack,
}: BroadcastConversationViewProps) {
  const router = useRouter();
  const { markBroadcastRead } = useBroadcastUnread();

  const [broadcasts, setBroadcasts] = useState<IPublicBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isNavigatingToDev, setIsNavigatingToDev] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getUserBroadcasts(50);
      // Data from server is newest first; reverse for thread view (oldest to newest)
      setBroadcasts([...data].reverse());
      markBroadcastRead();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [markBroadcastRead]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Scroll to bottom on initial load or new broadcasts
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading, broadcasts.length]);

  // Real-time Socket.IO listener for live broadcasts
  useEffect(() => {
    const socket = getSocket();

    const handleNewBroadcast = (newBroadcast: IPublicBroadcast) => {
      setBroadcasts((prev) => {
        const id = newBroadcast.id || (newBroadcast as any)._id;
        if (prev.some((b) => (b.id || (b as any)._id) === id)) {
          return prev;
        }
        return [...prev, newBroadcast];
      });

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    };

    socket.on("broadcast:new", handleNewBroadcast);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
    };
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleOpenDeveloperChat = async () => {
    setIsNavigatingToDev(true);
    try {
      const room = await createOrGetDeveloperRoom();
      router.push(`/private-chats/${room.id}`);
    } catch {
      router.push("/private-chats");
    } finally {
      setIsNavigatingToDev(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
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

          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate">Reviewer Bucket</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 uppercase tracking-wider shrink-0">
                Official
              </span>
            </div>
            <p className="text-[11px] text-muted truncate">Official announcements channel</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchBroadcasts}
            disabled={loading}
            className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-elevated transition-colors disabled:opacity-50"
            aria-label="Refresh announcements"
            title="Refresh announcements"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
              <div className="absolute right-0 mt-1.5 z-30 w-52 rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInfoModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-elevated transition-colors text-left"
                >
                  <Info className="w-3.5 h-3.5 text-secondary" />
                  <span>About Reviewer Bucket</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleOpenDeveloperChat();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-elevated transition-colors text-left"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Message Developer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Announcements Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <AnnouncementSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none">
            <p className="text-xs text-muted mb-3">{error}</p>
            <button
              type="button"
              onClick={fetchBroadcasts}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center select-none space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted">
              <Megaphone className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">No announcements yet</p>
            <p className="text-xs text-muted max-w-xs leading-relaxed">
              Official community announcements from Reviewer Bucket will appear here.
            </p>
          </div>
        ) : (
          broadcasts.map((broadcast, index) => {
            const broadcastKey = broadcast.id || (broadcast as any)._id || `b-${index}`;
            return (
              <div
                key={broadcastKey}
                className="flex flex-col max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                {/* Official Broadcast Message Container */}
                <div className="p-4 sm:p-5 rounded-2xl rounded-tl-sm bg-surface border border-border/80 shadow-2xs space-y-2.5 relative group">
                  {/* Sender Header Banner */}
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Megaphone className="w-3 h-3" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block leading-tight">
                          Reviewer Bucket
                        </span>
                        <span className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider block">
                          Official announcement
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-muted text-[10px] tabular-nums">
                      <Clock className="w-3 h-3 text-muted/60" />
                      <span>{formatAnnouncementTime(broadcast.createdAt)}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="py-1">
                    <p className="text-[14px] sm:text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words [word-break:break-word]">
                      {broadcast.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Read-Only Footer Banner */}
      <footer className="flex-shrink-0 border-t border-border bg-surface/90 backdrop-blur-xs p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-[11px] leading-snug">
              Official announcement channel • Read-only
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenDeveloperChat}
            disabled={isNavigatingToDev}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-elevated text-foreground text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isNavigatingToDev ? (
              <div className="w-3 h-3 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
            ) : (
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>Message Developer</span>
          </button>
        </div>
      </footer>

      {/* Info Modal */}
      <AnonymousInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
