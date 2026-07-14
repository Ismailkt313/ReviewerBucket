import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-background text-foreground flex items-center justify-center min-h-[50vh] px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Reviewer Not Found</h1>
          <p className="mt-2 text-sm text-secondary">
            The reviewer you are looking for does not exist or has been removed.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none dark:hover:bg-neutral-800"
            >
              Back to reviewers
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
