import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { Reviewer } from "@/app/data/reviewers";

type ReviewerCardProps = {
  reviewer: Reviewer;
  stats?: {
    averageRating: number | null;
    ratingCount: number;
    experienceCount: number;
    lastUpdated: string | null;
  };
};

export function formatExperiencesCount(count: number): string {
  if (count <= 99) return `${count}`;
  if (count <= 999) return "99+";
  if (count <= 1199) return "999+";
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export default function ReviewerCard({ reviewer, stats }: ReviewerCardProps) {
  const displayName = reviewer.name || "Anonymous Reviewer";
  const avatarChar = displayName.charAt(0).toUpperCase();

  const rating = stats?.averageRating ?? 0;
  const ratingCount = stats?.ratingCount ?? 0;
  const experienceCount = stats?.experienceCount ?? 0;

  const experiencesText = `${formatExperiencesCount(experienceCount)} Experience${experienceCount === 1 ? "" : "s"}`;

  return (
    <Link
      href={`/reviewers/${reviewer.slug}`}
      role="listitem"
      itemScope
      itemType="https://schema.org/Person"
      className="group flex flex-col justify-between gap-5 rounded-2xl border border-border bg-surface p-5 md:p-6 min-h-[230px] md:min-h-[260px] shadow-xs transition-all duration-200 hover:scale-[1.01] hover:shadow-md hover:border-neutral-400 dark:hover:border-neutral-550 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    >
      <div className="space-y-3.5">
        {/* Header Info */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-350 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-sm md:text-base font-bold text-secondary shadow-xs select-none flex-shrink-0">
              {avatarChar}
            </div>
            <div className="min-w-0">
              <h3 itemProp="name" className="truncate text-[17px] md:text-[23px] font-bold text-foreground group-hover:text-accent transition-colors leading-tight tracking-tight">
                {displayName}
              </h3>
              <span itemProp="alternateName" className="inline-block font-mono text-[13px] md:text-[16px] font-semibold text-secondary leading-none mt-1 tracking-wide">
                {reviewer.code}
              </span>
            </div>
          </div>
        </div>

        {/* Rating and Experience Summary */}
        <div 
          itemProp="aggregateRating" 
          itemScope 
          itemType="https://schema.org/AggregateRating"
          className="flex items-center gap-2 text-[15px] md:text-[17px] text-secondary font-semibold pt-0.5 tracking-tight leading-normal"
        >
          <meta itemProp="bestRating" content="5" />
          <meta itemProp="worstRating" content="1" />
          <meta itemProp="ratingValue" content={rating > 0 ? rating.toFixed(1) : "5.0"} />
          <meta itemProp="ratingCount" content={ratingCount > 0 ? ratingCount.toString() : "1"} />
          <meta itemProp="reviewCount" content={experienceCount > 0 ? experienceCount.toString() : "1"} />

          {ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current align-middle" />
                <span className="font-bold text-foreground text-[15px] md:text-[18px] align-middle">{rating.toFixed(1)}</span>
              </div>
              <span className="text-muted text-[13px]">•</span>
            </>
          ) : (
            <>
              <span className="text-muted text-[14px] md:text-[16px]">Unrated</span>
              <span className="text-muted text-[13px]">•</span>
            </>
          )}
          <span>{experiencesText}</span>
        </div>

        {/* Stack Chips */}
        {reviewer.stacks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {reviewer.stacks.slice(0, 3).map((stack) => (
              <span
                key={stack}
                itemProp="knowsAbout"
                className="inline-flex items-center rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-border/50 px-2.5 py-0.5 text-[12px] md:text-[15px] font-mono font-medium text-secondary tracking-tight"
              >
                {stack}
              </span>
            ))}
            {reviewer.stacks.length > 3 && (
              <span className="inline-flex items-center rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-border/50 px-2 py-0.5 text-[12px] md:text-[15px] font-mono font-medium text-secondary">
                +{reviewer.stacks.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[15px] md:text-[17px] text-muted group-hover:text-accent font-bold transition-colors tracking-tight leading-normal">
        <span>View Experiences</span>
        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
