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
            <p className="text-xs text-muted leading-relaxed max-w-md">
              Community contributions are welcome. Help improve Reviewer Bucket by contributing code, fixing issues, or suggesting new features.
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
                <a
                  href="https://github.com/Ismailkt313/ReviewerBucket"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-secondary hover:text-foreground transition-colors duration-150"
                >
                  Contribute on GitHub
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 flex flex-col items-center gap-3">
          <p className="text-xs text-muted leading-relaxed max-w-xl text-center">
            Reviewer Bucket is an independent, student-focused project and is not affiliated with Brototype.
          </p>
          <p className="text-xs text-muted">
            Reviewer Bucket &copy; {currentYear} | Developed by{" "}
            <a
              href="https://linkedin.com/in/ismail-kt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:text-foreground underline underline-offset-2 transition-colors duration-150"
            >
              Ismail KT
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
