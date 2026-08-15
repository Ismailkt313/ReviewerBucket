"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import NotificationPanel from "./NotificationPanel";
import MessagesDropdown from "./MessagesDropdown";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-md flex-shrink-0">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-foreground leading-none"
          >
            Reviewer Bucket
          </Link>
          <span className="hidden sm:inline text-[10px] text-muted font-medium mt-0.5">
            Community-driven interview experiences
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <MessagesDropdown />

          <NotificationPanel />

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}