"use client";

import React, { useCallback, useMemo } from "react";
import Link from "next/link";

const MESSAGES = [
  "Thanks for being part of Reviewer Bucket.",
  "Missing a reviewer? Let the community know.",
  "Been through an interview recently? Share it.",
  "Questions? The community chat is open.",
];

export default function AnnouncementBar() {
  const handleRequestReviewer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("open-request-reviewer-modal"));
  }, []);

  const handleFocusSearch = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const searchInput = document.getElementById("reviewer-search") as HTMLInputElement | null;
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        searchInput.focus();
      }, 350);
    } else {
      window.location.href = "/#reviewer-search";
    }
  }, []);

  const actions = useMemo(
    () => [
      {
        label: "Request Reviewer",
        href: "#",
        onClick: handleRequestReviewer,
      },
      {
        label: "Share Experience",
        href: "#reviewer-search",
        onClick: handleFocusSearch,
      },
      {
        label: "Community Chat",
        href: "/community",
      },
    ],
    [handleRequestReviewer, handleFocusSearch]
  );

  // Duplicated messages array for 100% seamless CSS marquee loop (-50% to 0 translateX)
  const duplicatedMessages = useMemo(
    () => [...MESSAGES, ...MESSAGES, ...MESSAGES],
    []
  );

  return (
    <aside
      aria-label="Site announcements"
      className="announcement-bar-container relative w-full border-b border-border/50 bg-surface/85 dark:bg-surface/60 backdrop-blur-md text-[12px] sm:text-[13px] select-none z-40 transition-colors"
    >
      {/* Screen Reader Only Accessible Summary */}
      <div className="sr-only">
        Reviewer Bucket announcements: Thanks for being part of Reviewer Bucket. Missing a reviewer? Let the community know. Been through an interview recently? Share it. Questions? The community chat is open.
      </div>

      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Zone: Live Rotating Informational Marquee Track */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center mr-3 sm:mr-6 min-w-0">
          {/* Live Activity Pulse Indicator */}
          <div className="flex items-center gap-2 mr-2.5 sm:mr-3 flex-shrink-0 z-20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>

          {/* Edge Gradient Mask Left */}
          <div
            className="pointer-events-none absolute left-4 sm:left-5 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-r from-surface dark:from-surface to-transparent z-10 motion-reduce:hidden"
            aria-hidden="true"
          />
          {/* Edge Gradient Mask Right */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-l from-surface dark:from-surface to-transparent z-10 motion-reduce:hidden"
            aria-hidden="true"
          />

          {/* Continuous Left-to-Right CSS Marquee Track */}
          <div className="w-full overflow-hidden motion-reduce:hidden pl-1">
            <div
              className="animate-announcement-marquee flex items-center whitespace-nowrap"
              aria-hidden="true"
            >
              {duplicatedMessages.map((msg, idx) => (
                <React.Fragment key={`${idx}-${msg}`}>
                  <span className="font-normal text-muted tracking-tight">
                    {msg}
                  </span>
                  <span className="mx-3.5 sm:mx-5 text-border/60 font-light text-[11px] sm:text-[12px]">
                    •
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Reduced Motion Static Fallback */}
          <div className="hidden motion-reduce:block text-muted font-normal truncate">
            {MESSAGES[0]}
          </div>
        </div>

        {/* Right Zone: Fixed Action Cluster (Touch-scrollable on Mobile, Static on Desktop) */}
        <div className="relative flex-shrink-0 max-w-[50%] sm:max-w-none">
          <nav
            aria-label="Community actions"
            className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory touch-pan-x py-1 [mask-image:linear-gradient(to_right,black_85%,transparent_100%)] sm:[mask-image:none]"
          >
            {actions.map((action, idx) => (
              <React.Fragment key={action.label}>
                {idx > 0 && (
                  <span
                    className="text-border/60 font-light select-none text-[11px] sm:text-[12px] flex-shrink-0 hidden sm:inline"
                    aria-hidden="true"
                  >
                    •
                  </span>
                )}
                {action.href.startsWith("/") ? (
                  <Link
                    href={action.href}
                    className="snap-start flex-shrink-0 min-h-[36px] sm:min-h-[44px] inline-flex items-center font-medium text-foreground hover:underline underline-offset-4 decoration-border/80 hover:decoration-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs px-1 whitespace-nowrap"
                  >
                    {action.label}
                  </Link>
                ) : (
                  <a
                    href={action.href}
                    onClick={action.onClick}
                    className="snap-start flex-shrink-0 min-h-[36px] sm:min-h-[44px] inline-flex items-center font-medium text-foreground hover:underline underline-offset-4 decoration-border/80 hover:decoration-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs px-1 cursor-pointer whitespace-nowrap"
                  >
                    {action.label}
                  </a>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
