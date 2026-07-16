"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useVisualViewport } from "@/app/hooks/useVisualViewport";
import Header from "./Header";
import ReviewerRatingSection from "./ReviewerRatingSection";
import StudentExperiencesFeed from "./StudentExperiencesFeed";

type ReviewerDetailWrapperProps = {
  reviewer: {
    id: string;
    name: string;
    code: string;
    stacks: string[];
  };
  averageRating: number | null;
  ratingCount: number;
  initialExperiences: {
    id: string;
    content: string;
    createdAt: string;
  }[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
};

export default function ReviewerDetailWrapper({
  reviewer,
  averageRating,
  ratingCount,
  initialExperiences,
  initialNextCursor,
  initialHasMore
}: ReviewerDetailWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useVisualViewport();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (mobile) {
          setIsCollapsed(true);
        }
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  const handleCollapsedChange = (collapsed: boolean) => {
    if (isMobile) {
      setIsCollapsed(collapsed);
    }
  };

  const resolvedCollapsed = isMobile ? isCollapsed : false;

  return (
    <div
      id="detail-page-container"
      className="fixed top-0 left-0 w-full flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        height: "var(--visual-viewport-height, 100dvh)",
        transform: "translateY(var(--visual-viewport-offset-top, 0px))"
      }}
    >
      <div className="flex-shrink-0">
        <Header />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-1 md:py-3 flex-1 min-h-0 flex flex-col w-full relative">
        <div
          onClick={() => isMobile && setIsCollapsed(prev => !prev)}
          className="md:hidden flex-shrink-0 flex items-center gap-3 px-4 h-12 border border-border bg-surface rounded-xl cursor-pointer select-none mb-1"
        >
          <Link
            href="/"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-secondary flex items-center justify-center min-w-[44px] min-h-[44px]"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground truncate">{reviewer.name}</span>
              <span className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold text-secondary flex-shrink-0">
                {reviewer.code}
              </span>
            </div>
            <span className="text-[10px] text-muted truncate block">{reviewer.stacks.join(" • ") || "General"}</span>
          </div>
          <div className="text-secondary p-1">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${resolvedCollapsed ? "" : "rotate-180"}`} />
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out origin-top flex-shrink-0 ${resolvedCollapsed ? "max-h-0 opacity-0 -translate-y-4 scale-95 pointer-events-none overflow-hidden pb-0" : "max-h-[350px] opacity-100 translate-y-0 scale-100 pb-4"}`}>
          <ReviewerRatingSection
            reviewerId={reviewer.id}
            reviewerName={reviewer.name}
            reviewerCode={reviewer.code}
            reviewerStacks={reviewer.stacks || []}
            initialAverageRating={averageRating}
            initialRatingCount={ratingCount}
            isCollapsed={resolvedCollapsed}
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <StudentExperiencesFeed
            key={reviewer.id}
            reviewerId={reviewer.id}
            initialExperiences={initialExperiences}
            initialNextCursor={initialNextCursor}
            initialHasMore={initialHasMore}
            onCollapsedChange={handleCollapsedChange}
          />
        </div>
      </div>
    </div>
  );
}
