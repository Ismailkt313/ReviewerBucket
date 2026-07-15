"use client";

import { useEffect, useRef, useState } from "react";

type LocalRating = {
  reviewerId: string;
  value: number;
  updatedAt: string;
};

type ReviewerRatingSectionProps = {
  reviewerId: string;
  initialRatingCount: number;
  initialRatingTotal: number;
};

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function ReviewerRatingSection({
  reviewerId,
  initialRatingCount,
  initialRatingTotal
}: ReviewerRatingSectionProps) {
  const [localRating, setLocalRating] = useState<number | undefined>(undefined);
  const [hoverRating, setHoverRating] = useState<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem("reviewerBucket:ratings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const found = parsed.find(
              (item: LocalRating) => item && item.reviewerId === reviewerId
            );
            if (
              found &&
              Number.isInteger(found.value) &&
              found.value >= 1 &&
              found.value <= 5
            ) {
              setLocalRating(found.value);
            }
          }
        }
      } catch {
        // Ignore defensively
      }
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [reviewerId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRate = (value: number) => {
    setLocalRating(value);

    try {
      const raw = localStorage.getItem("reviewerBucket:ratings");
      let list: LocalRating[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter(
            (item: LocalRating) =>
              item && typeof item === "object" && typeof item.reviewerId === "string"
          );
        }
      }
      const idx = list.findIndex((item) => item.reviewerId === reviewerId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          value,
          updatedAt: new Date().toISOString(),
        };
      } else {
        list.push({
          reviewerId,
          value,
          updatedAt: new Date().toISOString(),
        });
      }
      localStorage.setItem("reviewerBucket:ratings", JSON.stringify(list));
    } catch {
      // Ignore defensively
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setShowNotice(true);
    timerRef.current = setTimeout(() => {
      setShowNotice(false);
    }, 2000);
  };

  if (!mounted) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 animate-pulse flex flex-col gap-4">
        <div className="h-6 w-32 bg-border rounded" />
        <div className="h-4 w-48 bg-border rounded" />
      </div>
    );
  }

  const hasLocal = localRating !== undefined;
  const displayCount = hasLocal ? initialRatingCount + 1 : initialRatingCount;
  const displayAverage = hasLocal
    ? (initialRatingCount > 0
        ? (initialRatingTotal + localRating) / (initialRatingCount + 1)
        : localRating)
    : (initialRatingCount > 0
        ? initialRatingTotal / initialRatingCount
        : undefined);

  const roundedAvg = displayAverage !== undefined ? Math.round(displayAverage) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Student Rating
      </h2>

      {displayAverage !== undefined ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              {displayAverage.toFixed(1)}
            </span>
            <span className="text-sm text-muted">/ 5</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-500" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((num) => (
              <StarIcon key={num} filled={num <= roundedAvg} className="w-4.5 h-4.5" />
            ))}
          </div>

          <span className="text-xs text-secondary mt-1">
            Based on {displayCount} {displayCount === 1 ? "rating" : "ratings"}
          </span>
        </div>
      ) : (
        <p className="text-sm text-secondary font-medium">No ratings yet</p>
      )}

      <div className="mt-5 border-t border-border/60 pt-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between min-h-[16px]">
          <span className="text-xs font-semibold text-secondary">
            {localRating !== undefined ? `Your rating: ${localRating} out of 5` : "Your rating"}
          </span>
          {showNotice && (
            <span className="text-[11px] text-accent font-semibold transition-opacity duration-150">
              Rating updated
            </span>
          )}
        </div>

        <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((num) => {
            const activeRating = hoverRating !== undefined ? hoverRating : (localRating ?? 0);
            const isFilled = num <= activeRating;
            return (
              <button
                key={num}
                type="button"
                role="radio"
                aria-checked={localRating === num}
                aria-label={`Rate ${num} out of 5`}
                onMouseEnter={() => setHoverRating(num)}
                onMouseLeave={() => setHoverRating(undefined)}
                onClick={() => handleRate(num)}
                className="rounded-lg p-1 transition-colors duration-150 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <StarIcon filled={isFilled} className="w-6 h-6" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
