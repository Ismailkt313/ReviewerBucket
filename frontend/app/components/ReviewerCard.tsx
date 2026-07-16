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
      className="group flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-150 hover:shadow-sm hover:-translate-y-0.5 hover:border-neutral-400 dark:hover:border-neutral-500 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
    >
      <div className="space-y-2">
        {/* Header Info */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-350 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-xs font-bold text-secondary shadow-xs select-none flex-shrink-0">
              {avatarChar}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground group-hover:text-accent transition-colors leading-tight">
                {displayName}
              </h3>
              <span className="inline-block font-mono text-[9px] font-semibold text-secondary leading-none mt-0.5">
                {reviewer.code}
              </span>
            </div>
          </div>
        </div>

        {/* Rating and Experience Summary */}
        <div className="flex items-center gap-1.5 text-[11px] text-secondary font-medium">
          {ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-0.5 text-amber-500">
                <Star className="w-3 h-3 fill-current" />
                <span className="font-bold text-foreground text-[11px]">{rating.toFixed(1)}</span>
              </div>
              <span className="text-muted text-[9px]">•</span>
            </>
          ) : (
            <>
              <span className="text-muted text-[11px]">Unrated</span>
              <span className="text-muted text-[9px]">•</span>
            </>
          )}
          <span>{experiencesText}</span>
        </div>

        {/* Stack Chips */}
        {reviewer.stacks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reviewer.stacks.slice(0, 3).map((stack) => (
              <span
                key={stack}
                className="inline-flex items-center rounded-md bg-neutral-50 dark:bg-neutral-900 border border-border/50 px-1.5 py-0.5 text-[9px] font-mono font-medium text-secondary"
              >
                {stack}
              </span>
            ))}
            {reviewer.stacks.length > 3 && (
              <span className="inline-flex items-center rounded-md bg-neutral-50 dark:bg-neutral-900 border border-border/50 px-1.5 py-0.5 text-[9px] font-mono font-medium text-secondary">
                +{reviewer.stacks.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted group-hover:text-accent font-bold transition-colors">
        <span>View Experiences</span>
        <ArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
