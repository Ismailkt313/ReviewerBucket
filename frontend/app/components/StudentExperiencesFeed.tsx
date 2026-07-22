"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { getApiUrl } from "@/app/utils/api";
import { getSocket } from "@/app/utils/socket";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";
import { useNotifications } from "@/app/hooks/useNotifications";

type StudentExperience = {
  id: string;
  content: string;
  createdAt: string;
};

type StudentExperiencesFeedProps = {
  reviewerId: string;
  initialExperiences: StudentExperience[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isProfileCollapsed?: boolean;
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CommentSkeleton() {
  return (
    <div className="flex gap-2 items-start animate-skeleton-pulse">
      <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 space-y-1.5 py-0.5">
        <div className="h-3 w-14 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-3.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
    </div>
  );
}

export default function StudentExperiencesFeed({
  reviewerId,
  initialExperiences,
  initialNextCursor,
  initialHasMore,
  onCollapsedChange,
  isProfileCollapsed
}: StudentExperiencesFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTracker = useRef({ lastY: 0, cumulativeUp: 0 });
  const isUserScrollingRef = useRef(false);
  const shouldScrollToBottomRef = useRef(false);
  const ignoreScrollRef = useRef(false);

  const [experiencesList, setExperiencesList] = useState<StudentExperience[]>(initialExperiences);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const { markContentAsRead } = useNotifications();

  useEffect(() => {
    if (reviewerId) {
      const expIds = experiencesList.map((e) => e.id);
      markContentAsRead(reviewerId, expIds);
    }
  }, [reviewerId, experiencesList.length, markContentAsRead]);

  useEffect(() => {
    if (typeof window !== "undefined" && experiencesList.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const experienceId = params.get("experienceId");
      if (experienceId) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`exp-${experienceId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("highlight-pulse");
            const highlightTimer = setTimeout(() => {
              element.classList.remove("highlight-pulse");
            }, 3000);
            return () => clearTimeout(highlightTimer);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [experiencesList]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
      setUnreadCount(0);
    }
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    ignoreScrollRef.current = true;
    setExpandedComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 100);
  }, []);

  // Collapse profile card on scroll (existing behavior)
  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (ignoreScrollRef.current) return;
    if (!isUserScrollingRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    if (onCollapsedChange) {
      onCollapsedChange(scrollTop > 180);
    }
  }, [onCollapsedChange]);

  // ──────────────────────────────────────────────
  // Community-page scroll/keyboard handling
  // Blur textarea when scrolling up to dismiss keyboard stably
  // ──────────────────────────────────────────────
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
      }, 400);
    };

    const handleWheel = () => {
      isUserScrollingRef.current = true;
      setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 400);
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

  // Ignore scroll events for 400ms after the profile collapsed state changes to prevent transition scroll events from overriding the state
  useEffect(() => {
    ignoreScrollRef.current = true;
    const timer = setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [isProfileCollapsed]);

  // Scroll to bottom when own message is sent
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      isUserScrollingRef.current = false;
      scrollToBottom("smooth");
      shouldScrollToBottomRef.current = false;
    }
  }, [experiencesList, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        setIsReady(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExperiencesList(initialExperiences);
      setNextCursor(initialNextCursor);
      setHasMore(initialHasMore);
      setUnreadCount(0);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialExperiences, initialNextCursor, initialHasMore]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      socket.emit("reviewer:join", { reviewerId });
    };

    if (socket.connected) {
      socket.emit("reviewer:join", { reviewerId });
    }

    socket.on("connect", handleConnect);

    const handleNewExperience = (newExp: StudentExperience) => {
      const nearBottom = isNearBottom();
      setExperiencesList((prev) => {
        if (prev.some((e) => e.id === newExp.id)) return prev;
        return [...prev, newExp];
      });

      if (nearBottom) {
        setTimeout(() => {
          scrollToBottom("smooth");
        }, 50);
      } else {
        setUnreadCount((count) => count + 1);
      }
    };

    socket.on("experience:new", handleNewExperience);

    return () => {
      socket.emit("reviewer:leave", { reviewerId });
      socket.off("connect", handleConnect);
      socket.off("experience:new", handleNewExperience);
    };
  }, [reviewerId, isNearBottom, scrollToBottom]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);

    try {
      const url = getApiUrl(`/api/reviewers/${reviewerId}/experiences?limit=20&cursor=${nextCursor}`);
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const fetched: StudentExperience[] = json.data.experiences || [];
          setExperiencesList((prev) => [...fetched, ...prev]);
          setNextCursor(json.data.nextCursor || null);
          setHasMore(json.data.hasMore || false);
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingMore(false);
    }
  };

  const submittingRef = useRef(false);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (submittingRef.current || isSubmitting) return;

    const trimmed = inputText.trim();
    if (trimmed.length < 2) {
      setError("Please write at least 2 characters.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Written experience cannot exceed 1000 characters.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    const tempId = `temp-${Date.now()}`;
    const tempExperience: StudentExperience = {
      id: tempId,
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    // Optimistic UI update: instantly append experience to list
    setExperiencesList((prev) => [...prev, tempExperience]);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
    shouldScrollToBottomRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout limit

    try {
      const res = await fetch(getApiUrl(`/api/reviewers/${reviewerId}/experiences`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: trimmed,
          anonymousClientId: getAnonymousClientId()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("Submission failed");
      }

      const json = await res.json();
      if (json && json.data && json.data.id) {
        const realExperience: StudentExperience = {
          id: json.data.id,
          content: json.data.content,
          createdAt: json.data.createdAt
        };
        // Replace temp experience with real experience
        setExperiencesList((prev) =>
          prev.map((item) => (item.id === tempId ? realExperience : item))
        );
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      // Rollback optimistic update on error
      setExperiencesList((prev) => prev.filter((item) => item.id !== tempId));
      setInputText(trimmed);

      if (err.name === "AbortError") {
        setError("Request timed out. Please check your connection and try again.");
      } else {
        setError("Failed to submit experience. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, isSubmitting]);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border bg-surface rounded-2xl overflow-clip relative">
      {/* Header bar */}
      <div className="px-3 py-1.5 md:px-4 md:py-2 border-b border-border/60 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between flex-shrink-0">
        <h2 className="text-[10px] md:text-xs font-extrabold tracking-wider uppercase text-secondary">
          Student Experiences
        </h2>
        <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-secondary">
          {experiencesList.length}
        </span>
      </div>

      {/* Scrollable feed area */}
      <div
        ref={scrollRef}
        onScroll={handleContainerScroll}
        className={`flex-1 overflow-y-auto scroll-smooth overscroll-contain min-h-0 transition-opacity duration-150 ${isReady ? "opacity-100" : "opacity-0"}`}
      >
        <div className="min-h-full flex flex-col px-3 py-2.5 md:px-4 md:py-3 gap-1.5 md:gap-2">
          {hasMore && (
            <div className="flex justify-center pb-1.5 border-b border-border/40 flex-shrink-0">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-[11px] text-secondary font-bold px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-h-[44px]"
              >
                Load older experiences
              </button>
            </div>
          )}

          {isLoadingMore && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <CommentSkeleton />
              <CommentSkeleton />
              <CommentSkeleton />
            </div>
          )}

          {experiencesList.length > 0 ? (
            <div className="flex flex-col gap-1 md:gap-1.5">
              {experiencesList.map((exp) => {
                const isLong = exp.content.length > 260;
                const isExpanded = !!expandedComments[exp.id];
                const displayText = isLong && !isExpanded
                  ? exp.content.slice(0, 240) + "..."
                  : exp.content;

                return (
                  <div
                    key={exp.id}
                    id={`exp-${exp.id}`}
                    className="flex gap-2 items-start text-sm bg-background/40 hover:bg-background/70 p-2 md:p-2.5 rounded-xl border border-border/30 transition-colors duration-150"
                  >
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-neutral-100 dark:bg-neutral-850 flex items-center justify-center flex-shrink-0 text-[9px] md:text-[10px] font-bold text-muted select-none">
                      A
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-bold text-foreground text-[10px] md:text-[11px]"
                        >
                          <span>Anonymous Student</span>
                        </span>
                        <span className="text-[9px] md:text-[10px] text-muted font-medium">
                          {getRelativeTime(exp.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] md:text-[13px] text-secondary leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {displayText}
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(exp.id)}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="ml-1.5 inline-block text-[11px] font-bold text-accent hover:underline focus-visible:outline-none"
                          >
                            {isExpanded ? "Show less" : "Read more"}
                          </button>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact empty state — no large blank gap */
            <div className="flex flex-col items-center justify-end text-center py-6 gap-2 select-none mt-auto">
              <MessageSquare className="w-7 h-7 text-neutral-300 dark:text-neutral-700" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  No experiences yet
                </p>
                <p className="text-[11px] text-muted max-w-[240px]">
                  Be the first student to share your interview experience.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-background text-[11px] font-bold shadow-lg hover:scale-105 transition-transform duration-150 motion-reduce:transition-none border border-accent"
        >
          <ArrowDown className="w-3 h-3" />
          <span>{unreadCount} New {unreadCount === 1 ? "Experience" : "Experiences"}</span>
        </button>
      )}

      {/* Composer — always pinned at bottom */}
      <div className="border-t border-border/60 bg-surface/95 backdrop-blur-xs px-3 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] flex flex-col gap-1 relative flex-shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.03)]">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <label htmlFor="feed-input" className="sr-only">
            Share your experience
          </label>
          <textarea
            id="feed-input"
            ref={textareaRef}
            value={inputText}
            disabled={isSubmitting}
            onChange={(e) => {
              setInputText(e.target.value);
              setError("");
              requestAnimationFrame(adjustTextareaHeight);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Share your experience..."
            maxLength={1000}
            rows={1}
            className="flex-1 rounded-2xl border border-border/60 bg-background px-3.5 py-2 text-[16px] text-foreground placeholder:text-muted focus:border-neutral-400 focus:ring-2 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500 resize-none min-h-[38px] max-h-[120px] overflow-y-auto transition-[height] duration-150 ease-out"
          />

          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            onMouseDown={(e) => e.preventDefault()}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-accent text-background flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label="Send experience"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        {error && (
          <div className="flex items-center justify-between gap-2 bg-red-50/70 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/40 rounded-xl px-3 py-1.5 text-[11px] text-red-650 dark:text-red-400">
            <span className="font-semibold">{error}</span>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="flex-shrink-0 bg-red-650 text-white dark:bg-red-900 dark:text-red-100 px-2.5 py-1 rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes highlight-pulse-animation {
          0% { background-color: rgba(244, 63, 94, 0.25); border-color: rgba(244, 63, 94, 0.6); }
          50% { background-color: rgba(244, 63, 94, 0.45); border-color: rgba(244, 63, 94, 0.9); }
          100% { background-color: transparent; }
        }
        .highlight-pulse {
          animation: highlight-pulse-animation 3s ease-out;
        }
      `}</style>
    </div>
  );
}
