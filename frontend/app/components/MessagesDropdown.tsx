"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleMore, Users, User, Wrench, Megaphone } from "lucide-react";
import { useCommunityUnread } from "../hooks/useCommunityUnread";
import { usePrivateUnread } from "../hooks/usePrivateUnread";
import { useBroadcastUnread } from "../hooks/useBroadcastUnread";
import { createOrGetDeveloperRoom } from "../services/private-rooms";

export default function MessagesDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeveloperLoading, setIsDeveloperLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { unreadCount: communityUnread } = useCommunityUnread();
  const { totalUnreadCount: privateUnread } = usePrivateUnread();
  const { unreadCount: broadcastUnread } = useBroadcastUnread();

  const totalUnread = communityUnread + privateUnread + broadcastUnread;
  const displayCount = totalUnread > 9 ? "9+" : totalUnread.toString();
  const communityDisplay = communityUnread > 9 ? "9+" : communityUnread.toString();
  const privateDisplay = privateUnread > 9 ? "9+" : privateUnread.toString();
  const broadcastDisplay = broadcastUnread > 9 ? "9+" : broadcastUnread.toString();

  const handleOpenDeveloperChat = async () => {
    setIsDeveloperLoading(true);
    setIsOpen(false);
    try {
      const room = await createOrGetDeveloperRoom();
      router.push(`/private-chats/${room.id}`);
    } catch {
      router.push("/private-chats");
    } finally {
      setIsDeveloperLoading(false);
    }
  };

  // Close dropdown on click outside and escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative z-50" ref={dropdownRef}>
      {/* Header Messaging Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus min-w-[36px] min-h-[36px]"
        aria-label={`Messages${totalUnread > 0 ? ` (${displayCount} unread)` : ""}`}
        title="Messages"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MessageCircleMore className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-background ring-2 ring-background animate-pulse">
            {displayCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Messages navigation"
          className="absolute right-0 mt-2 z-[100] w-72 sm:w-80 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-3 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-neutral-50/50 dark:bg-neutral-900/30">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-secondary">
              Messages
            </h3>
            {totalUnread > 0 && (
              <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400">
                {displayCount} unread
              </span>
            )}
          </div>

          {/* Options List */}
          <div className="p-2 space-y-1">
            {/* Community Chat Entry */}
            <Link
              href="/community"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:outline-none transition-colors duration-150 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-400 flex-shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
                  Community
                </p>
                <p className="text-[11px] text-muted leading-tight mt-0.5">
                  {communityUnread > 0 ? (
                    <span className="text-rose-500 dark:text-rose-400 font-medium">
                      New activity
                    </span>
                  ) : (
                    "Public discussions"
                  )}
                </p>
              </div>
              {communityUnread > 0 && (
                <span className="flex-shrink-0 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-background ring-2 ring-background">
                  {communityDisplay}
                </span>
              )}
            </Link>

            {/* Private Chats Entry */}
            <Link
              href="/private-chats"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:outline-none transition-colors duration-150 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400 flex-shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
                  Private Chats
                </p>
                <p className="text-[11px] text-muted leading-tight mt-0.5">
                  {privateUnread > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {privateUnread} unread message{privateUnread > 1 ? "s" : ""}
                    </span>
                  ) : (
                    "Direct 1-on-1 conversations"
                  )}
                </p>
              </div>
              {privateUnread > 0 && (
                <span className="flex-shrink-0 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-background ring-2 ring-background">
                  {privateDisplay}
                </span>
              )}
            </Link>

            {/* Official Announcements Entry */}
            <Link
              href="/private-chats/broadcast"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:outline-none transition-colors duration-150 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 flex-shrink-0">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
                  Announcements
                </p>
                <p className="text-[11px] text-muted leading-tight mt-0.5">
                  {broadcastUnread > 0 ? (
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {broadcastUnread} unread update{broadcastUnread > 1 ? "s" : ""}
                    </span>
                  ) : (
                    "Official Reviewer Bucket channel"
                  )}
                </p>
              </div>
              {broadcastUnread > 0 && (
                <span className="flex-shrink-0 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {broadcastDisplay}
                </span>
              )}
            </Link>

            <div className="h-px bg-border/60 mx-1 my-1" />

            {/* Message the Developer Entry */}
            <button
              type="button"
              role="menuitem"
              disabled={isDeveloperLoading}
              onClick={handleOpenDeveloperChat}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:outline-none transition-colors duration-150 group text-left disabled:opacity-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex-shrink-0">
                {isDeveloperLoading ? (
                  <div className="w-4 h-4 border-2 border-border border-t-amber-500 rounded-full animate-spin" />
                ) : (
                  <Wrench className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
                  Message the Developer
                </p>
                <p className="text-[11px] text-muted leading-tight mt-0.5">
                  Direct support & feedback
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
