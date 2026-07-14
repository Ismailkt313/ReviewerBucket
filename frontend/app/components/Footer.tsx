import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8">
          <div className="flex flex-col gap-3">
            <span className="text-base font-semibold tracking-tight text-foreground">
              Reviewer Bucket
            </span>
            <p className="text-sm text-secondary max-w-xs leading-relaxed">
              A simple, student-focused reviewer finder created to search and identify reviewers by their codes or names.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <span className="text-sm font-semibold tracking-wider text-muted uppercase">
              Navigation
            </span>
            <nav className="flex flex-col gap-2 md:items-end">
              <Link href="#how-it-works" className="text-sm text-secondary hover:text-foreground transition-colors duration-150">
                How It Works
              </Link>
              <Link href="#about" className="text-sm text-secondary hover:text-foreground transition-colors duration-150">
                About
              </Link>
              <Link href="#faq" className="text-sm text-secondary hover:text-foreground transition-colors duration-150">
                FAQ
              </Link>
            </nav>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Reviewer Bucket. All rights reserved.
          </p>
          <p className="text-xs text-muted max-w-md sm:text-right leading-relaxed">
            Reviewer Bucket is an independent, student-focused lookup utility. It is not affiliated with, endorsed by, or connected to Brocamp or Brototype.
          </p>
        </div>
      </div>
    </footer>
  );
}
