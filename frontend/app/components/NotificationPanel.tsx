"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare, MessageCircleMore, UserCheck, RefreshCw, Loader2 } from "lucide-react";
import { useNotifications, getRelativeTime, NotificationItem } from "../hooks/useNotifications";
import { getApiUrl } from "../utils/api";

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [loadingNotificationId, setLoadingNotificationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const router = useRouter();
  const { notifications, unreadCount, markAllAsRead, markSingleAsRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);
    setActionError(null);

    const success = await markAllAsRead();
    if (!success) {
      setActionError("Failed to mark all as read. Please try again.");
    }
    setIsMarkingAll(false);
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (loadingNotificationId) return;
    setActionError(null);
    setLoadingNotificationId(n.id);

    try {
      // 1. Resolve canonical reviewer slug dynamically using immutable reviewerId (or fallback to stored reviewerSlug)
      let resolvedSlug: string | undefined = n.reviewerSlug;
      const lookupIdentifier = n.reviewerId || n.reviewerSlug;

      if (lookupIdentifier) {
        try {
          const res = await fetch(getApiUrl(`/api/reviewers/${lookupIdentifier}`), { cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            if (json && json.data && json.data.slug) {
              resolvedSlug = json.data.slug;
            }
          }
        } catch {
          // Fallback to stored reviewerSlug
        }
      }

      // 2. Navigate to destination page using the resolved latest slug
      if (resolvedSlug) {
        const url = n.experienceId
          ? `/reviewers/${resolvedSlug}?experienceId=${n.experienceId}`
          : `/reviewers/${resolvedSlug}`;
        router.push(url);
      }

      // 3. Mark ONLY that specific notification as read after navigation is initiated
      if (!n.isRead) {
        const success = await markSingleAsRead(n.id);
        if (!success) {
          setActionError("Could not update read state.");
        }
      }

      // 4. Close panel
      setIsOpen(false);
    } catch (err) {
      console.error("Navigation error:", err);
      setActionError("Navigation failed.");
    } finally {
      setLoadingNotificationId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_experience":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
        );
      case "community_message":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400">
            <MessageCircleMore className="h-4.5 w-4.5" />
          </div>
        );
      case "reviewer_approved":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
            <UserCheck className="h-4.5 w-4.5" />
          </div>
        );
      case "reviewer_update_approved":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400">
            <RefreshCw className="h-4.5 w-4.5" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-500/10 text-neutral-500 dark:bg-neutral-500/20 dark:text-neutral-400">
            <Bell className="h-4.5 w-4.5" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus min-w-[36px] min-h-[36px]"
        aria-label="Toggle notifications panel"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-background ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 max-h-[480px] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-neutral-50/50 dark:bg-neutral-900/30">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-secondary">
              Platform Activity
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="text-[10px] font-bold text-accent hover:underline focus:outline-none disabled:opacity-50 flex items-center gap-1"
              >
                {isMarkingAll && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {actionError && (
            <div className="px-4 py-1.5 bg-red-500/10 text-red-500 text-[11px] font-medium border-b border-red-500/20 text-center">
              {actionError}
            </div>
          )}

          {/* List Area */}
          <div className="flex-1 overflow-y-auto scroll-smooth py-1 divide-y divide-border/40 max-h-[380px]">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 p-3.5 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 transition-colors duration-150 relative cursor-pointer ${
                    loadingNotificationId === n.id ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">{getIcon(n.type)}</div>

                  {/* Message and Time */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] sm:text-[13px] text-secondary font-medium leading-relaxed break-words whitespace-pre-wrap">
                      {n.message}
                    </p>
                    <span className="block mt-1 text-[10px] text-muted font-semibold tracking-tight">
                      {getRelativeTime(n.createdAt)}
                    </span>
                  </div>

                  {/* Unread indicator dot */}
                  {!n.isRead && (
                    <div className="flex-shrink-0 self-center">
                      <span className="block h-2 w-2 rounded-full bg-accent" title="Unread activity" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-850 text-neutral-400 dark:text-neutral-600 mb-3">
                  <Bell className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-extrabold text-foreground mb-1">
                  All caught up!
                </h4>
                <p className="text-[11px] text-muted max-w-[200px]">
                  No recent platform activity. Notifications automatically expire after 150 minutes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
