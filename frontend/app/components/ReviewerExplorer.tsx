"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Reviewer } from "@/app/data/reviewers";
import ReviewerCard from "./ReviewerCard";
import AddReviewerModal from "./AddReviewerModal";
import { Plus, Search, X, ChevronDown } from "lucide-react";
import { detectQueryType } from "@/app/utils/queryDetector";
import { getApiUrl } from "@/app/utils/api";

type ReviewerExplorerProps = {
  reviewers: Reviewer[];
};

type ReviewerStats = {
  averageRating: number | null;
  ratingCount: number;
  experienceCount: number;
  lastUpdated: string | null;
};

const INITIAL_STACKS = ["All", "MERN", "Flutter", "AI/ML", "Python"];
const MORE_STACKS = [
  "QA Team",
  "Media",
  "Game Development (Unity)",
  "Game Development (Unreal)",
  "Data Science",
  "Golang"
];

function normalizeQuery(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, "").trim();
}

function matchesReviewer(reviewer: Reviewer, query: string): boolean {
  if (!query) return true;

  const normalized = normalizeQuery(query);
  const normalizedName = normalizeQuery(reviewer.name);
  const normalizedCode = normalizeQuery(reviewer.code);
  const codeNumbers = reviewer.code.replace(/\D/g, "");

  return (
    normalizedName.includes(normalized) ||
    normalizedCode.includes(normalized) ||
    codeNumbers === normalized
  );
}

function ReviewerCardSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 animate-skeleton-pulse shadow-xs">
      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex-shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-3.5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="flex gap-1">
          <div className="h-3.5 w-10 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          <div className="h-3.5 w-10 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="pt-2 border-t border-border/40 h-3.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

export default function ReviewerExplorer({ reviewers: initialReviewers }: ReviewerExplorerProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>(initialReviewers);
  const [query, setQuery] = useState("");
  const [selectedStack, setSelectedStack] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, ReviewerStats>>({});
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const [modalConfig, setModalConfig] = useState<{
    name: string;
    code: string;
    focusField: "name" | "code";
  }>({ name: "", code: "", focusField: "name" });

  const openModalWithQuery = (searchQuery: string) => {
    const detected = detectQueryType(searchQuery);
    if (detected.type === "code") {
      setModalConfig({
        name: "",
        code: detected.normalizedValue || "",
        focusField: "name"
      });
    } else if (detected.type === "name") {
      setModalConfig({
        name: detected.normalizedValue || "",
        code: "",
        focusField: "code"
      });
    } else {
      setModalConfig({
        name: "",
        code: "",
        focusField: "name"
      });
    }
    setIsModalOpen(true);
  };

  const openModalBlank = () => {
    setModalConfig({
      name: "",
      code: "",
      focusField: "name"
    });
    setIsModalOpen(true);
  };

  const searchParams = useSearchParams();
  const router = useRouter();

  const isAddParamOpen = searchParams.get("add") === "true";
  const finalIsModalOpen = isModalOpen || isAddParamOpen;

  // Load stats from API
  useEffect(() => {
    const loadStats = async () => {
      setIsStatsLoading(true);
      const newStats: Record<string, ReviewerStats> = {};

      try {
        await Promise.all(
          reviewers.map(async (r) => {
            let averageRating: number | null = null;
            let ratingCount = 0;
            let experienceCount = 0;
            let lastUpdated: string | null = null;

            try {
              const ratingRes = await fetch(getApiUrl(`/api/reviewers/${r.id}/rating-summary`));
              if (ratingRes.ok) {
                const ratingJson = await ratingRes.json();
                if (ratingJson?.data) {
                  averageRating = ratingJson.data.averageRating;
                  ratingCount = ratingJson.data.ratingCount;
                }
              }
            } catch {}

            try {
              const expRes = await fetch(getApiUrl(`/api/reviewers/${r.id}/experiences`));
              if (expRes.ok) {
                const expJson = await expRes.json();
                if (expJson?.data) {
                  experienceCount = expJson.data.experiences?.length || 0;
                  if (expJson.data.experiences && expJson.data.experiences.length > 0) {
                    lastUpdated = expJson.data.experiences[0].createdAt;
                  }
                }
              }
            } catch {}

            newStats[r.id] = {
              averageRating,
              ratingCount,
              experienceCount,
              lastUpdated
            };
          })
        );
      } catch {}

      setStatsMap(newStats);
      setIsStatsLoading(false);
    };

    loadStats();
  }, [reviewers]);

  const isSearching = query.trim() !== "";

  // Filtering
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      const matchesSearch = matchesReviewer(r, query);
      const matchesStack = selectedStack === "All" || r.stacks.includes(selectedStack);
      return matchesSearch && matchesStack;
    });
  }, [reviewers, query, selectedStack]);

  // Default sorting to "Most Reviewed"
  const sortedReviewers = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const statsA = statsMap[a.id];
      const statsB = statsMap[b.id];
      return (statsB?.experienceCount || 0) - (statsA?.experienceCount || 0);
    });
  }, [filtered, statsMap]);

  // Aggregate Stats
  const aggregateStats = useMemo(() => {
    const totalReviewers = reviewers.length;
    const totalExperiences = Object.values(statsMap).reduce((sum, s) => sum + s.experienceCount, 0);
    const totalStacks = new Set(reviewers.flatMap((r) => r.stacks)).size;

    return {
      totalReviewers,
      totalExperiences,
      totalStacks
    };
  }, [reviewers, statsMap]);

  const handleAddSuccess = (newReviewer: {
    id: string;
    name: string;
    code: string;
    slug: string;
    stacks: string[];
  }) => {
    setReviewers((prev) => [...prev, newReviewer]);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (searchParams.get("add") === "true") {
      router.push("/");
    }
  };

  const isMoreSelected = MORE_STACKS.includes(selectedStack);

  return (
    <>
      {/* Hero & Search Sticky Area */}
      <section className="px-4 pt-10 pb-4 sm:px-6 lg:px-8 sm:pt-14 text-center max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Reviewer Bucket
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Find honest interview experiences shared by students.
          </p>
        </div>

        {/* Large Search Bar - Sticky on Mobile */}
        <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:relative sm:top-0 sm:py-0">
          <div className="relative max-w-3xl mx-auto">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="reviewer-search"
              type="text"
              role="searchbox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviewer name, reviewer code or stack..."
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-11 text-[15px] md:text-sm text-foreground shadow-xs transition-all duration-150 placeholder:text-muted/65 focus:border-neutral-400 focus:ring-4 focus:ring-focus/10 focus:outline-none dark:focus:border-neutral-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Subtle Stats Row */}
        <div className="text-center text-[11px] text-muted font-bold select-none tracking-wide pt-1">
          {aggregateStats.totalReviewers} Reviewers • {aggregateStats.totalExperiences} Experiences • {aggregateStats.totalStacks} Stacks
        </div>
      </section>

      {/* Main Exploratory Area */}
      <section
        id="reviewers"
        aria-label="Reviewer directory"
        className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          {/* Stack Filter Chips Row */}
          <div className="flex items-center gap-1.5 border-b border-border/70 pb-4 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none select-none">
            {INITIAL_STACKS.map((stack) => (
              <button
                key={stack}
                type="button"
                onClick={() => setSelectedStack(stack)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors select-none ${
                  selectedStack === stack
                    ? "bg-accent text-background"
                    : "bg-surface border border-border/70 hover:bg-neutral-50 dark:hover:bg-neutral-855 text-secondary"
                }`}
              >
                {stack}
              </button>
            ))}

            {/* More Stack Popover Dropdown */}
            <div className="relative inline-block flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors select-none flex items-center gap-1.5 ${
                  isMoreSelected
                    ? "bg-accent text-background"
                    : "bg-surface border border-border/70 hover:bg-neutral-50 dark:hover:bg-neutral-855 text-secondary"
                }`}
              >
                <span>{isMoreSelected ? selectedStack : "More"}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {isMoreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                    {MORE_STACKS.map((stack) => (
                      <button
                        key={stack}
                        type="button"
                        onClick={() => {
                          setSelectedStack(stack);
                          setIsMoreOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          selectedStack === stack
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-secondary hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-foreground"
                        }`}
                      >
                        {stack}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          {isStatsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <ReviewerCardSkeleton key={i} />
              ))}
            </div>
          ) : sortedReviewers.length > 0 ? (
            <div
              role="list"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-5"
            >
              {sortedReviewers.map((reviewer) => (
                <ReviewerCard
                  key={reviewer.id}
                  reviewer={reviewer}
                  stats={statsMap[reviewer.id]}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 text-center sm:mt-16">
              <h3 className="text-base font-bold text-foreground">
                {isSearching ? `Couldn't find "${query}"` : "No reviewer found"}
              </h3>
              <p className="mt-1.5 text-xs text-secondary">
                {isSearching
                  ? "Check the spelling, search for another stack, or add this reviewer to the directory."
                  : "No reviewers are matching the current filters."}
              </p>
              {isSearching ? (
                <button
                  type="button"
                  onClick={() => openModalWithQuery(query)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent text-background px-4 py-2.5 text-xs font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add &ldquo;{query}&rdquo; as a reviewer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openModalBlank}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent text-background px-4 py-2.5 text-xs font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Reviewer
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <AddReviewerModal
        isOpen={finalIsModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleAddSuccess}
        initialName={isAddParamOpen ? "" : modalConfig.name}
        initialCode={isAddParamOpen ? "" : modalConfig.code}
        focusField={isAddParamOpen ? "name" : modalConfig.focusField}
        key={`${finalIsModalOpen}-${isAddParamOpen}-${modalConfig.name}-${modalConfig.code}`}
      />
    </>
  );
}
