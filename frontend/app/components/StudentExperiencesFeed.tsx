"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown, MessageSquare } from "lucide-react";
import { getApiUrl } from "@/app/utils/api";
import { getSocket } from "@/app/utils/socket";

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
    <div className="flex gap-3 items-start animate-skeleton-pulse">
      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
    </div>
  );
}

export default function StudentExperiencesFeed({
  reviewerId,
  initialExperiences,
  initialNextCursor,
  initialHasMore,
  onCollapsedChange
}: StudentExperiencesFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [experiencesList, setExperiencesList] = useState<StudentExperience[]>(initialExperiences);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (onCollapsedChange) {
      onCollapsedChange(scrollTop > 180);
    }
  }, [onCollapsedChange]);

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

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (isSubmitting) return;

    const trimmed = inputText.trim();
    if (trimmed.length < 2) {
      setError("Please write at least 2 characters.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Written experience cannot exceed 1000 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(getApiUrl(`/api/reviewers/${reviewerId}/experiences`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: trimmed
        })
      });

      if (!res.ok) {
        throw new Error("Submission failed");
      }

      setInputText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } catch {
      setError("Failed to submit experience. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleSendTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border bg-surface rounded-2xl overflow-clip relative">
      <div className="px-3 py-2 md:px-4 md:py-3 border-b border-border/60 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between flex-shrink-0">
        <h2 className="text-xs font-extrabold tracking-wider uppercase text-secondary">
          Student Experiences
        </h2>
        <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-bold text-secondary">
          {experiencesList.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto scroll-smooth overscroll-contain min-h-0 transition-opacity duration-150 ${isReady ? "opacity-100" : "opacity-0"}`}
      >
        <div className="min-h-full flex flex-col p-4 gap-4">
          {hasMore && (
            <div className="flex justify-center pb-2 border-b border-border/40 flex-shrink-0">
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
            <div className="flex flex-col gap-4 flex-shrink-0">
              <CommentSkeleton />
              <CommentSkeleton />
              <CommentSkeleton />
            </div>
          )}

          {experiencesList.length > 0 ? (
            <div className="flex flex-col gap-2 md:gap-3">
              {experiencesList.map((exp) => (
                <div
                  key={exp.id}
                  className="flex gap-2 md:gap-3 items-start text-sm bg-background/40 hover:bg-background/80 p-2 md:p-2.5 rounded-lg md:rounded-xl border border-border/40 transition-colors duration-150 animate-slide-up-fade"
                >
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-neutral-100 dark:bg-neutral-850 flex items-center justify-center flex-shrink-0 text-[10px] md:text-xs font-bold text-muted shadow-xs select-none">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11px] md:text-xs">Anonymous Student</span>
                      <span className="text-[9px] md:text-[10px] text-muted font-medium">
                        {getRelativeTime(exp.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs md:text-sm text-secondary leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {exp.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3 select-none">
              <div className="text-4xl text-neutral-300 dark:text-neutral-700">
                <MessageSquare className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Be the first to share your experience
                </p>
                <p className="text-xs text-muted max-w-[280px]">
                  Help future students by sharing your interview process and questions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => textareaRef.current?.focus()}
                className="mt-2 text-xs font-bold text-background bg-accent px-4 py-2 rounded-lg border border-accent hover:opacity-90 transition-opacity min-h-[44px]"
              >
                Write Experience
              </button>
            </div>
          )}
        </div>
      </div>

      {unreadCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-18 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-background text-[11px] font-bold shadow-lg hover:scale-105 transition-transform duration-150 border border-accent"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>{unreadCount} New {unreadCount === 1 ? "Experience" : "Experiences"}</span>
        </button>
      )}

      <div className="border-t border-border/60 bg-surface/95 backdrop-blur-xs px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] flex flex-col gap-1.5 relative flex-shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
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
            placeholder="Share your experience..."
            maxLength={1000}
            rows={1}
            className="flex-1 rounded-2xl border border-border/60 bg-background px-3.5 py-2 text-[16px] text-foreground placeholder:text-muted focus:border-neutral-400 focus:ring-2 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500 resize-none min-h-[40px] max-h-[120px] overflow-y-auto transition-[height] duration-150 ease-out"
          />

          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            onMouseDown={handleSendMouseDown}
            onTouchStart={handleSendTouchStart}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-accent text-background flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label="Send experience"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        {error && (
          <p className="text-[11px] text-red-650 dark:text-red-400 font-semibold px-1">{error}</p>
        )}
      </div>
    </div>
  );
}
