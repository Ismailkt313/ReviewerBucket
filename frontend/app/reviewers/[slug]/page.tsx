import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { reviewers } from "@/app/data/reviewers";
import { experiences } from "@/app/data/experiences";
import { ratings } from "@/app/data/ratings";
import ReviewerRatingSection from "@/app/components/ReviewerRatingSection";
import StudentExperiencesFeed from "@/app/components/StudentExperiencesFeed";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return reviewers.map((r) => ({
    slug: r.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const reviewer = reviewers.find((r) => r.slug === slug);
  if (!reviewer) {
    return {
      title: "Reviewer Not Found | Reviewer Bucket",
    };
  }
  return {
    title: `${reviewer.name} (${reviewer.code}) | Reviewer Bucket`,
    description: `Lookup reviewer codes and details for Brocamp and Brototype reviewer ${reviewer.name} (${reviewer.code}) on Reviewer Bucket.`,
  };
}

export default async function ReviewerDetailPage({ params }: Props) {
  const { slug } = await params;
  const reviewer = reviewers.find((r) => r.slug === slug);

  if (!reviewer) {
    notFound();
  }

  const approved = experiences.filter(
    (exp) => exp.reviewerId === reviewer.id && exp.status === "approved"
  );

  const sortedApproved = [...approved].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  const reviewerRatings = ratings.filter(
    (r) => r.reviewerId === reviewer.id && Number.isInteger(r.value) && r.value >= 1 && r.value <= 5
  );

  const ratingCount = reviewerRatings.length;
  const ratingTotal = reviewerRatings.reduce((sum, r) => sum + r.value, 0);

  return (
    <>
      <Header />
      <main className="flex-1 bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none dark:hover:bg-neutral-800"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to reviewers
          </Link>
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-20 pt-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 border-b border-border pb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {reviewer.name}
            </h1>
            <span className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1 font-mono text-sm font-medium text-secondary">
              {reviewer.code}
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-6">
            {reviewer.stacks && reviewer.stacks.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-5">
                  <span className="text-xs font-semibold tracking-wider text-muted uppercase">
                    Stacks
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reviewer.stacks.map((stack) => (
                      <span
                        key={stack}
                        className="inline-flex items-center rounded-md bg-background border border-border px-2 py-0.5 font-mono text-xs font-medium text-secondary"
                      >
                        {stack}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-sm text-secondary">
                  Reviewer information is being added.
                </p>
              </div>
            )}

            <ReviewerRatingSection
              reviewerId={reviewer.id}
              initialRatingCount={ratingCount}
              initialRatingTotal={ratingTotal}
            />

            <div className="border-t border-border pt-8 mt-2">
              <StudentExperiencesFeed
                reviewerId={reviewer.id}
                initialExperiences={sortedApproved}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
