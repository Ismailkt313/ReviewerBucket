"use client";

import { useEffect, useRef, useState, useCallback, useMemo, JSX } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  ArrowLeft,
  MoreVertical,
  Info,
  Wrench,
  Clock,
  RefreshCw,
  Pin,
  ArrowDown,
  X
} from "lucide-react";
import {
  IPublicBroadcast,
  BroadcastCategory,
  BroadcastPriority,
  getUserBroadcasts
} from "@/app/services/broadcasts";
import { createOrGetDeveloperRoom } from "@/app/services/private-rooms";
import { getSocket } from "@/app/utils/socket";
import { useBroadcastUnread } from "../hooks/useBroadcastUnread";
import ScrollArea from "@/app/components/ScrollArea";
import AnonymousInfoModal from "./AnonymousInfoModal";

export interface BroadcastConversationViewProps {
  onBack?: () => void;
}

// ─── Domain Label & Style Helpers ─────────────────────────────────────────────

function getCategoryLabel(category?: BroadcastCategory | string): string {
  switch (category) {
    case "FEATURE_UPDATE":
      return "Feature Update";
    case "PRODUCT_UPDATE":
      return "Product Update";
    case "COMMUNITY":
      return "Community";
    case "IMPORTANT":
      return "Important";
    case "SYSTEM":
      return "System";
    default:
      return "Community";
  }
}

function getPriorityLabel(priority?: BroadcastPriority | string): string {
  switch (priority) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    case "IMPORTANT":
      return "Important";
    case "NORMAL":
    default:
      return "Normal";
  }
}

interface PriorityStyles {
  badge: string;
  line: string;
  dot: string;
}

function getPriorityStyles(priority?: BroadcastPriority | string): PriorityStyles {
  switch (priority) {
    case "CRITICAL":
      return {
        badge: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
        line: "bg-gradient-to-r from-rose-500 via-rose-500/80 to-rose-500/20",
        dot: "bg-rose-500"
      };
    case "HIGH":
      return {
        badge: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
        line: "bg-gradient-to-r from-amber-500 via-amber-500/80 to-amber-500/20",
        dot: "bg-amber-500"
      };
    case "IMPORTANT":
      return {
        badge: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
        line: "bg-gradient-to-r from-sky-500 via-sky-500/80 to-sky-500/20",
        dot: "bg-sky-500"
      };
    case "NORMAL":
    default:
      return {
        badge: "text-secondary bg-neutral-100 dark:bg-neutral-800 border-border",
        line: "bg-border/90",
        dot: "bg-secondary"
      };
  }
}

function formatAnnouncementTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });

  return `${dateStr} · ${timeStr}`;
}

function getDateGroupLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) return "Today";

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" })
  }).toUpperCase();
}

interface BroadcastGroup {
  dateLabel: string;
  items: IPublicBroadcast[];
}

function groupBroadcasts(broadcasts: IPublicBroadcast[]): BroadcastGroup[] {
  const groups: BroadcastGroup[] = [];
  let currentLabel = "";
  let currentGroup: IPublicBroadcast[] = [];

  for (const b of broadcasts) {
    const d = new Date(b.createdAt);
    const label = isNaN(d.getTime()) ? "Older" : getDateGroupLabel(d);

    if (label !== currentLabel) {
      if (currentGroup.length > 0) {
        groups.push({ dateLabel: currentLabel, items: currentGroup });
      }
      currentLabel = label;
      currentGroup = [b];
    } else {
      currentGroup.push(b);
    }
  }

  if (currentGroup.length > 0) {
    groups.push({ dateLabel: currentLabel, items: currentGroup });
  }

  return groups;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function AnnouncementSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full p-4 sm:p-6 animate-pulse" aria-hidden="true">
      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-28" />
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded-full w-16" />
        </div>
        <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4" />
        <div className="h-[2px] bg-neutral-200 dark:bg-neutral-800 rounded-full w-full" />
        <div className="space-y-2 pt-1">
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-full" />
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-4/5" />
        </div>
        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-24 pt-1" />
      </div>

      <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-24" />
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded-full w-14" />
        </div>
        <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3" />
        <div className="h-[2px] bg-neutral-200 dark:bg-neutral-800 rounded-full w-full" />
        <div className="space-y-2 pt-1">
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-full" />
          <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
        </div>
        <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-20 pt-1" />
      </div>
    </div>
  );
}

// ─── Single Announcement Item Component ───────────────────────────────────────

interface AnnouncementItemProps {
  broadcast: IPublicBroadcast;
  onOpenPoster?: (imageUrl: string) => void;
}

function AnnouncementItem({ broadcast, onOpenPoster }: AnnouncementItemProps): JSX.Element {
  const categoryLabel = getCategoryLabel(broadcast.category);
  const priorityLabel = getPriorityLabel(broadcast.priority);
  const priorityStyles = getPriorityStyles(broadcast.priority);
  const isPoster = broadcast.broadcastType === "POSTER" || !!broadcast.posterImageUrl;

  return (
    <article
      className="p-5 sm:p-6 rounded-2xl bg-surface border border-border shadow-xs hover:border-foreground/20 transition-all space-y-3.5 relative group"
      aria-label={`Announcement: ${broadcast.title || categoryLabel}`}
    >
      {/* Top Metadata: Category & Priority */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
            {categoryLabel}
          </span>
          {isPoster && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
              Poster
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {broadcast.isPinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <Pin className="w-2.5 h-2.5" />
              <span>Pinned</span>
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${priorityStyles.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyles.dot}`} aria-hidden="true" />
            <span>{priorityLabel}</span>
          </span>
        </div>
      </div>

      {isPoster && broadcast.posterImageUrl ? (
        /* ─── Poster Announcement Display ─── */
        <div className="space-y-3 pt-0.5">
          <div
            className="relative rounded-2xl overflow-hidden border border-border bg-neutral-950 shadow-sm group/poster cursor-pointer"
            onClick={() => onOpenPoster?.(broadcast.posterImageUrl!)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={broadcast.posterImageUrl}
              alt={broadcast.title ? `${broadcast.title} - ${broadcast.content}` : broadcast.content}
              className="w-full h-auto object-cover max-h-[520px] transition-transform duration-200 group-hover/poster:scale-[1.01]"
              loading="lazy"
            />
            {/* Subtle Zoom Badge */}
            <div className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-opacity opacity-0 group-hover/poster:opacity-100 shadow-md">
              <span className="text-[10px] font-semibold px-1">Click to expand</span>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Standard Text Announcement Display ─── */
        <>
          {/* Announcement Title (if provided) */}
          {broadcast.title && (
            <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight leading-snug break-words">
              {broadcast.title}
            </h3>
          )}

          {/* Semantic Priority Visual Line */}
          <div
            className={`h-[2px] w-full rounded-full transition-colors ${priorityStyles.line}`}
            aria-hidden="true"
          />

          {/* Announcement Body Content */}
          <div className="pt-0.5">
            <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words [word-break:break-word] font-normal">
              {broadcast.content}
            </p>
          </div>
        </>
      )}

      {/* Timestamp */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-muted font-normal tabular-nums">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted" />
          <time dateTime={broadcast.createdAt}>
            {formatAnnouncementTime(broadcast.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
}

// ─── Main User Announcement Channel Component ─────────────────────────────────

export default function BroadcastConversationView({
  onBack,
}: BroadcastConversationViewProps): JSX.Element {
  const router = useRouter();
  const { markBroadcastRead } = useBroadcastUnread();

  const [broadcasts, setBroadcasts] = useState<IPublicBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isNavigatingToDev, setIsNavigatingToDev] = useState(false);
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getUserBroadcasts(50);
      setBroadcasts([...data].reverse());
      markBroadcastRead();
      setHasNewAnnouncements(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, [markBroadcastRead]);

  // Initial fetch on mount
  useEffect(() => {
    let isMounted = true;

    getUserBroadcasts(50)
      .then((data) => {
        if (!isMounted) return;
        setBroadcasts([...data].reverse());
        setLoading(false);
        markBroadcastRead();
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load announcements.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [markBroadcastRead]);

  // Track scroll position to prevent interrupting user while reading
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
    if (isNearBottomRef.current && hasNewAnnouncements) {
      setHasNewAnnouncements(false);
    }
  }, [hasNewAnnouncements]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      setHasNewAnnouncements(false);
    }
  }, []);

  // Initial scroll to bottom on load
  useEffect(() => {
    if (!loading && broadcasts.length > 0) {
      scrollToBottom(false);
    }
  }, [loading, scrollToBottom, broadcasts.length]);

  // Real-time Socket.IO listener for live broadcasts
  useEffect(() => {
    const socket = getSocket();

    const handleNewBroadcast = (newBroadcast: IPublicBroadcast) => {
      if (!newBroadcast || newBroadcast.deliveryMode === "DIRECT_MESSAGE") return;

      const newId = newBroadcast.id || newBroadcast._id;

      setBroadcasts((prev) => {
        // Prevent duplicates
        if (prev.some((b) => (b.id || b._id) === newId)) {
          return prev;
        }
        return [...prev, newBroadcast];
      });

      // Mark read if user is currently active on the announcement page
      markBroadcastRead();

      // If user was near bottom, scroll down; otherwise show new announcement pill
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      } else {
        setHasNewAnnouncements(true);
      }
    };

    socket.on("broadcast:new", handleNewBroadcast);

    return () => {
      socket.off("broadcast:new", handleNewBroadcast);
    };
  }, [markBroadcastRead, scrollToBottom]);

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

  // Group broadcasts chronologically by date
  const groupedBroadcasts = useMemo(() => {
    return groupBroadcasts(broadcasts);
  }, [broadcasts]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* ─── Compact Channel Header ────────────────────────────────────────── */}
      <header className="px-4 py-3 border-b border-border bg-surface/95 backdrop-blur-md shrink-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 text-secondary hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors md:hidden shrink-0"
                aria-label="Back to conversations"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-border text-foreground flex items-center justify-center text-xs font-bold shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground truncate">
                  Reviewer Bucket
                </span>
                <span className="bg-neutral-100 dark:bg-neutral-800 border border-border text-secondary text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                  Official
                </span>
              </div>
              <p className="text-xs text-foreground/90 font-medium leading-tight truncate">
                Official announcements
              </p>
              <p className="text-[11px] text-muted font-normal leading-tight truncate hidden sm:block">
                Product updates and important community notes
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-secondary hover:text-foreground rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              aria-label="Refresh announcements"
              title="Refresh announcements"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
                <div className="absolute right-0 mt-1.5 z-30 w-52 rounded-2xl border border-border bg-surface shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsInfoModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <Info className="w-3.5 h-3.5 text-muted" />
                    <span>About Reviewer Bucket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleOpenDeveloperChat();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <Wrench className="w-3.5 h-3.5 text-muted" />
                    <span>Message Developer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Announcements Feed ────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-background">
        <ScrollArea
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full p-4 sm:p-6"
          aria-label="Official announcements feed"
        >
          <div className="max-w-2xl mx-auto w-full pb-6 space-y-6">
            {loading ? (
              <AnnouncementSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center select-none space-y-3">
                <p className="text-xs text-muted font-normal">Unable to load announcements.</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="px-4 py-1.5 bg-foreground text-background hover:opacity-90 text-xs font-semibold rounded-full transition-opacity shadow-xs"
                >
                  Try again
                </button>
              </div>
            ) : broadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center select-none space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-border text-secondary flex items-center justify-center mx-auto shadow-xs">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">No announcements yet.</p>
                  <p className="text-xs text-muted font-normal max-w-xs mx-auto">
                    Official updates from Reviewer Bucket will appear here.
                  </p>
                </div>
              </div>
            ) : (
              groupedBroadcasts.map((group) => (
                <div key={group.dateLabel} className="space-y-4">
                  {/* Subtle Date Separator */}
                  <div className="flex items-center justify-center my-4" aria-hidden="true">
                    <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold uppercase tracking-wider text-muted border border-border/50">
                      {group.dateLabel}
                    </span>
                  </div>

                  {/* Announcement Items in Date Group */}
                  <div className="space-y-4">
                    {group.items.map((broadcast) => {
                      const broadcastKey = broadcast.id || broadcast._id;
                      return (
                        <AnnouncementItem
                          key={broadcastKey}
                          broadcast={broadcast}
                          onOpenPoster={(url) => setLightboxImageUrl(url)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Floating "New Announcement" Button */}
        {hasNewAnnouncements && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold shadow-lg hover:opacity-90 transition-opacity"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>New announcement</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Read-Only Footer & Action Area ────────────────────────────────── */}
      <footer className="flex-shrink-0 border-t border-border bg-surface px-4 py-3">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-1.5 text-xs text-muted font-normal">
            <span className="text-[11px]">ⓘ Official announcements · Read-only</span>
          </div>

          <button
            type="button"
            onClick={handleOpenDeveloperChat}
            disabled={isNavigatingToDev}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 text-xs font-semibold transition-opacity disabled:opacity-40 shadow-xs"
          >
            {isNavigatingToDev ? (
              <div className="w-3.5 h-3.5 border-2 border-background/40 border-t-background rounded-full animate-spin" />
            ) : (
              <Wrench className="w-3.5 h-3.5" />
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

      {/* Lightbox Modal for Poster Zoom */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImageUrl}
            alt="Full size announcement poster"
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
