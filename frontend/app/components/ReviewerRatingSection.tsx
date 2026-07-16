"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getApiUrl } from "@/app/utils/api";
import { getAnonymousClientId } from "@/app/utils/anonymous-id";

type LocalRating = {
  reviewerId: string;
  value: number;
  updatedAt: string;
};

type ReviewerRatingSectionProps = {
  reviewerId: string;
  reviewerName: string;
  reviewerCode: string;
  reviewerStacks: string[];
  initialAverageRating: number | null;
  initialRatingCount: number;
  isCollapsed?: boolean;
  onEditClick?: () => void;
};

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499c.196-.399.768-.399.965 0l2.362 4.79 5.284.77c.44.064.617.61.298.92l-3.824 3.727.902 5.26c.075.441-.39.78-.778.572l-4.726-2.485-4.727 2.485c-.389.208-.854-.131-.778-.572l.901-5.26-3.824-3.727c-.319-.31-.143-.856.297-.92l5.284-.77 2.362-4.79z"
      />
    </svg>
  );
}

export default function ReviewerRatingSection({
  reviewerId,
  reviewerName,
  reviewerCode,
  reviewerStacks,
  initialAverageRating,
  initialRatingCount,
  isCollapsed = false,
  onEditClick
}: ReviewerRatingSectionProps) {
  const [localRating, setLocalRating] = useState<number | undefined>(undefined);
  const [hoverRating, setHoverRating] = useState<number | undefined>(undefined);
  const [averageRating, setAverageRating] = useState<number | null>(initialAverageRating);
  const [ratingCount, setRatingCount] = useState<number>(initialRatingCount);
  const [mounted, setMounted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
        // Ignore
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

  const handleRate = async (value: number) => {
    setErrorMessage("");
    try {
      const clientUuid = getAnonymousClientId();

      const res = await fetch(getApiUrl(`/api/reviewers/${reviewerId}/rating`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          value,
          anonymousClientId: clientUuid
        })
      });

      if (!res.ok) {
        throw new Error("Rating submission failed");
      }

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
            reviewerId,
            value,
            updatedAt: new Date().toISOString()
          };
        } else {
          list.push({
            reviewerId,
            value,
            updatedAt: new Date().toISOString()
          });
        }
        localStorage.setItem("reviewerBucket:ratings", JSON.stringify(list));
      } catch {
        // Ignore
      }

      const summaryRes = await fetch(getApiUrl(`/api/reviewers/${reviewerId}/rating-summary`));
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        if (summaryJson && summaryJson.data) {
          setAverageRating(summaryJson.data.averageRating);
          setRatingCount(summaryJson.data.ratingCount);
        }
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setShowNotice(true);
      timerRef.current = setTimeout(() => {
        setShowNotice(false);
      }, 2000);
    } catch {
      setErrorMessage("Could not submit rating. Please try again.");
    }
  };

  if (!mounted) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 flex flex-col items-center gap-4 animate-skeleton-pulse">
        <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
      </div>
    );
  }

  const roundedAvg = averageRating !== null ? Math.round(averageRating) : 0;
  const displayName = reviewerName || "Anonymous Reviewer";
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div className="relative rounded-2xl border border-border bg-surface p-3.5 flex flex-col items-center text-center shadow-xs" aria-hidden={isCollapsed}>
        <Link
          href="/"
          className="hidden md:inline-flex absolute top-3 left-3 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-secondary transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-neutral-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none z-10"
          aria-label="Back to reviewers"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>

        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center text-lg font-bold text-secondary shadow-xs select-none mb-1.5">
          {avatarChar}
        </div>

        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {displayName}
          </h1>
          <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-semibold text-secondary">
            {reviewerCode}
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-1 mt-1">
          {reviewerStacks.map((stack) => (
            <span
              key={stack}
              className="inline-flex items-center rounded-md bg-neutral-50 dark:bg-neutral-900 border border-border/60 px-1.5 py-0.5 text-[10px] font-mono font-medium text-secondary"
            >
              {stack}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-1.5">
          <div className="flex items-center gap-0.5 text-amber-500" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((num) => (
              <StarIcon key={num} filled={num <= roundedAvg} className="w-3.5 h-3.5" />
            ))}
          </div>
          <span className="text-sm font-bold text-foreground">
            {averageRating !== null ? averageRating.toFixed(1) : "0.0"}
          </span>
          <span className="text-xs text-muted">
            • {ratingCount} {ratingCount === 1 ? "Rating" : "Ratings"}
          </span>
        </div>

        <div className="mt-2.5 pt-2 border-t border-border/50 w-full max-w-xs flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-1.5 min-h-[16px]">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              {localRating !== undefined ? `Your rating: ${localRating} / 5` : "Rate this reviewer"}
            </span>
            {showNotice && (
              <span className="text-[10px] text-accent font-semibold animate-slide-up-fade">
                • Updated
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
                  className="rounded-lg p-1.5 transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <StarIcon filled={isFilled} className="w-6 h-6" />
                </button>
              );
            })}
          </div>
          {errorMessage && (
            <p className="text-[11px] text-red-650 dark:text-red-400 font-semibold">{errorMessage}</p>
          )}
        </div>

        {/* Edit Action */}
        {onEditClick && (
          <div className="mt-3 pt-3 border-t border-border/50 w-full flex justify-center">
            <button
              type="button"
              onClick={onEditClick}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-foreground transition-colors min-h-[44px]"
            >
              <span>✏️ Suggest an edit</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
