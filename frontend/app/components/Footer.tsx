import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12">
          {/* Brand Column (Left) */}
          <div className="md:col-span-6 space-y-3">
            <Link
              href="/"
              className="text-base sm:text-lg font-bold tracking-tight text-foreground inline-block hover:opacity-90 transition-opacity"
            >
              Reviewer Bucket
            </Link>
            <p className="text-xs sm:text-sm text-secondary leading-relaxed max-w-md">
              A student-focused platform to find reviewers, learn from honest interview experiences, and participate in an open Brototype community.
            </p>
          </div>

          {/* Navigation Columns (Right) */}
          <div className="md:col-span-6 grid grid-cols-2 gap-8 md:justify-items-end">
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-muted block">
                Explore
              </span>
              <nav className="flex flex-col space-y-2.5">
                <Link
                  href="#how-it-works"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  How It Works
                </Link>
                <Link
                  href="#about"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  About
                </Link>
                <Link
                  href="#faq"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  FAQ
                </Link>
              </nav>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-muted block">
                Community
              </span>
              <nav className="flex flex-col space-y-2.5">
                <Link
                  href="/community"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  Community Chat
                </Link>
                <Link
                  href="/private-chats"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  Private Chats
                </Link>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Left-to-Right layout with Disclaimer on left, Copyright on right */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-muted leading-relaxed max-w-xl">
            Reviewer Bucket is an independent, student-focused project and is not affiliated with Brototype.
          </p>
          <p className="text-xs text-muted whitespace-nowrap">
            &copy; {currentYear} Reviewer Bucket. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
