import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

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
          <Link
            href="/community"
            aria-label="Community"
            title="Community"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <MessageCircleMore className="h-5 w-5" />
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}