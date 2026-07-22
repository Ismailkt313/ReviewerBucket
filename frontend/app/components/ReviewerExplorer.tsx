"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Reviewer } from "@/app/data/reviewers";
import ReviewerCard from "./ReviewerCard";
import AddReviewerModal from "./AddReviewerModal";
import { Plus, Search, X, ChevronDown } from "lucide-react";
import { detectQueryType } from "@/app/utils/queryDetector";
import { getApiUrl } from "@/app/utils/api";
import { getSocket } from "@/app/utils/socket";

type ReviewerExplorerProps = {
  reviewers: Reviewer[];
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
    <div className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-surface p-6 md:p-7 min-h-[260px] md:min-h-[290px] animate-skeleton-pulse shadow-xs">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 md:w-[52px] md:h-[52px] rounded-full bg-neutral-200 dark:bg-neutral-800 flex-shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4.5 w-28 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-4.5 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="flex gap-1.5">
          <div className="h-4 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
          <div className="h-4 w-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="pt-3 border-t border-border/40 h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

export default function ReviewerExplorer({ reviewers: initialReviewers }: ReviewerExplorerProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>(initialReviewers);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStack, setSelectedStack] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    setReviewers(initialReviewers);
  }, [initialReviewers]);

  useEffect(() => {
    const socket = getSocket();

    const handleApproved = (data: { reviewer: Reviewer }) => {
      if (!data?.reviewer) return;
      setReviewers((prev) => {
        const exists = prev.some((r) => r.id === data.reviewer.id);
        if (exists) {
          return prev.map((r) => (r.id === data.reviewer.id ? { ...r, ...data.reviewer } : r));
        }
        return [...prev, data.reviewer];
      });
    };

    const handleUpdated = (data: { reviewer: Reviewer }) => {
      if (!data?.reviewer) return;
      setReviewers((prev) =>
        prev.map((r) => (r.id === data.reviewer.id ? { ...r, ...data.reviewer } : r))
      );
    };

    const handleStatsUpdated = (data: { reviewerId: string; stats: any }) => {
      if (!data?.reviewerId) return;
      setReviewers((prev) =>
        prev.map((r) =>
          r.id === data.reviewerId
            ? { ...r, stats: { ...r.stats, ...data.stats } }
            : r
        )
      );
    };

    socket.on("reviewer:approved", handleApproved);
    socket.on("reviewer:updated", handleUpdated);
    socket.on("reviewer:stats:updated", handleStatsUpdated);

    return () => {
      socket.off("reviewer:approved", handleApproved);
      socket.off("reviewer:updated", handleUpdated);
      socket.off("reviewer:stats:updated", handleStatsUpdated);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // Progressive rendering count
  const [visibleCount, setVisibleCount] = useState(8);

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

  // Keydown event listener for Escape closing popover
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMoreOpen]);

  // Filtering
  const filtered = useMemo(() => {
    return reviewers.filter((r) => {
      const matchesSearch = matchesReviewer(r, debouncedQuery);
      const matchesStack = selectedStack === "All" || r.stacks.includes(selectedStack);
      return matchesSearch && matchesStack;
    });
  }, [reviewers, debouncedQuery, selectedStack]);

  // Default sorting to alphabetical by name
  const sortedReviewers = useMemo(() => {
    return [...filtered].sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    });
  }, [filtered]);

  // Sliced progressive cards
  const visibleReviewers = useMemo(() => {
    return sortedReviewers.slice(0, visibleCount);
  }, [sortedReviewers, visibleCount]);

  const hasMoreToShow = sortedReviewers.length > visibleCount;
  const showLessButton = !hasMoreToShow && sortedReviewers.length > 8;

  // Aggregate Stats
  const aggregateStats = useMemo(() => {
    const totalReviewers = reviewers.length;
    const totalExperiences = reviewers.reduce((sum, r) => sum + (r.stats?.experienceCount || 0), 0);
    const totalStacks = new Set(reviewers.flatMap((r) => r.stacks)).size;

    return {
      totalReviewers,
      totalExperiences,
      totalStacks
    };
  }, [reviewers]);

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
      <section className="px-4 pt-12 md:pt-20 pb-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto space-y-6 md:space-y-8">
        <div className="space-y-2 md:space-y-3">
          <h1 className="text-[33px] md:text-[49px] font-bold tracking-tight text-foreground leading-tight">
            Reviewer Bucket
          </h1>
          <p className="text-[17px] md:text-[21px] font-medium text-secondary tracking-tight">
            Find honest interview experiences shared by students.
          </p>
        </div>

        {/* Large Search Bar - Sticky on Mobile */}
        <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:relative sm:top-0 sm:py-0">
          <div className="relative max-w-3xl mx-auto pt-1">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-muted" />
            <input
              id="reviewer-search"
              type="text"
              role="searchbox"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(8);
              }}
              placeholder="Search reviewer name, reviewer code or stack..."
              autoComplete="off"
              className="h-14 md:h-[60px] w-full rounded-2xl border border-border bg-surface text-center placeholder:text-center pl-12 md:pl-14 pr-12 md:pr-14 text-[16px] md:text-[19px] placeholder:text-[16px] md:placeholder:text-[19px] text-foreground shadow-xs transition-all duration-155 placeholder:text-muted/65 focus:border-neutral-400 focus:ring-4 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setVisibleCount(8);
                }}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              >
                <X className="w-4.5 h-4.5 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Subtle Stats Row */}
        <div className="text-center text-[14px] md:text-[17px] text-muted font-bold select-none tracking-wide pt-1 leading-normal">
          {aggregateStats.totalReviewers} Reviewers • {aggregateStats.totalExperiences} Experiences • {aggregateStats.totalStacks} Stacks
        </div>
      </section>

      {/* Main Exploratory Area */}
      <section
        id="reviewers"
        aria-label="Reviewer directory"
        className="border-t border-border bg-background px-4 py-8 md:py-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          {/* Stack Filter Chips Row */}
          <div className="relative border-b border-border/70 pb-4 mb-8 md:mb-10">
            <div className="flex items-center gap-2 overflow-x-auto sm:overflow-x-visible -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none select-none">
              {INITIAL_STACKS.map((stack) => (
                <button
                  key={stack}
                  type="button"
                  onClick={() => {
                    setSelectedStack(stack);
                    setVisibleCount(8);
                  }}
                  className={`flex-shrink-0 h-10 md:h-[44px] px-4 md:px-[22px] rounded-full text-[14px] md:text-[16px] font-bold transition-colors select-none tracking-tight ${
                    selectedStack === stack
                      ? "bg-accent text-background"
                      : "bg-surface border border-border/70 hover:bg-neutral-55 dark:hover:bg-neutral-855 text-secondary"
                  }`}
                >
                  {stack}
                </button>
              ))}

              {/* More Stack Popover Button */}
              <div className="relative inline-block flex-shrink-0">
                <button
                  type="button"
                  id="more-stack-trigger"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={`flex-shrink-0 h-10 md:h-[44px] px-4 md:px-[22px] rounded-full text-[14px] md:text-[16px] font-bold transition-colors select-none flex items-center gap-2 tracking-tight ${
                    isMoreSelected
                      ? "bg-accent text-background"
                      : "bg-surface border border-border/70 hover:bg-neutral-50 dark:hover:bg-neutral-855 text-secondary"
                  }`}
                >
                  <span>{isMoreSelected ? selectedStack : "More"}</span>
                  <ChevronDown className="w-4 h-4 align-middle" />
                </button>

                {/* DESKTOP popover menu: aligned left edges with 8px mt-2 gap and z-index */}
                {isMoreOpen && (
                  <>
                    {/* Transparent Click overlay to dismiss dropdown on desktop */}
                    <div className="hidden sm:block fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />
                    <div className="hidden sm:block absolute left-0 mt-2 min-w-full w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg z-50 max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                      {MORE_STACKS.map((stack) => (
                        <button
                          key={stack}
                          type="button"
                          onClick={() => {
                            setSelectedStack(stack);
                            setVisibleCount(8);
                            setIsMoreOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg text-[13px] md:text-[14px] font-bold transition-colors ${
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

            {/* MOBILE Bottom Sheet layout */}
            {isMoreOpen && (
              <div className="sm:hidden">
                {/* Semi-transparent Backdrop overlay */}
                <div
                  className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 animate-in fade-in duration-200"
                  onClick={() => setIsMoreOpen(false)}
                />
                {/* Swipeable Bottom Sheet */}
                <div className="fixed inset-x-0 bottom-0 bg-surface rounded-t-2xl border-t border-border z-50 flex flex-col max-h-[75vh] animate-in slide-in-from-bottom duration-200 ease-out pb-safe">
                  {/* Drag Handle Indicator */}
                  <div className="mx-auto my-3.5 w-10 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-850 flex-shrink-0" />
                  
                  {/* Sheet Header */}
                  <div className="px-4 pb-3.5 border-b border-border/40 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-foreground">Select Stacks</span>
                    <button
                      type="button"
                      onClick={() => setIsMoreOpen(false)}
                      className="text-[14px] font-bold text-muted hover:text-foreground"
                    >
                      Done
                    </button>
                  </div>

                  {/* Scrollable touch options list (minimum 44px h-11 height touch targets) */}
                  <div className="overflow-y-auto px-2.5 py-4 space-y-1.5">
                    {MORE_STACKS.map((stack) => (
                      <button
                        key={stack}
                        type="button"
                        onClick={() => {
                          setSelectedStack(stack);
                          setVisibleCount(8);
                          setIsMoreOpen(false);
                        }}
                        className={`w-full text-left h-11 px-4 rounded-xl text-[13px] md:text-[14px] font-bold flex items-center justify-between transition-colors ${
                          selectedStack === stack
                            ? "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                            : "text-secondary hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-foreground"
                        }`}
                      >
                        <span>{stack}</span>
                        {selectedStack === stack && (
                          <span className="text-accent text-[11px] font-mono">Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cards Grid */}
          {sortedReviewers.length > 0 ? (
            <>
              <div
                role="list"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {visibleReviewers.map((reviewer) => (
                  <div key={reviewer.id} className="animate-slide-up-fade">
                    <ReviewerCard
                      reviewer={reviewer}
                      stats={reviewer.stats}
                    />
                  </div>
                ))}
              </div>

              {/* Show More / Show Less Progressive Button */}
              {(hasMoreToShow || showLessButton) && (
                <div className="flex justify-center pt-10 md:pt-14">
                  {hasMoreToShow ? (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 8)}
                      className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-7 rounded-xl border border-border bg-surface hover:bg-neutral-50 dark:hover:bg-neutral-900 text-[13px] md:text-[15px] font-bold text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus shadow-xs tracking-tight"
                    >
                      Show More Reviewers
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(8)}
                      className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-7 rounded-xl border border-border bg-surface hover:bg-neutral-50 dark:hover:bg-neutral-900 text-[13px] md:text-[15px] font-bold text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus shadow-xs tracking-tight"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              )}

              {/* Community invitation CTA placement */}
              <div className="mt-12 md:mt-16 border-t border-border/40 pt-8 max-w-lg mx-auto select-none">
                <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-xs flex flex-col items-center justify-center sm:bg-transparent sm:border-none sm:p-0 sm:shadow-none">
                  <h4 className="text-[15px] md:text-[17px] font-bold text-foreground tracking-tight">Can&rsquo;t find your reviewer?</h4>
                  <p className="text-[12px] md:text-[14px] text-muted mt-1 leading-normal tracking-tight">Help the community by adding one.</p>
                  <button
                    type="button"
                    onClick={openModalBlank}
                    className="mt-4 w-full sm:w-auto inline-flex h-11 md:h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-6 text-[13px] md:text-[15px] font-bold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-focus shadow-xs tracking-tight"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Request Reviewer</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 text-center sm:mt-16 max-w-sm mx-auto p-6 border border-border rounded-xl bg-surface sm:bg-transparent sm:border-none sm:p-0">
              <h3 className="text-[15px] md:text-[17px] font-bold text-foreground tracking-tight">
                Couldn&rsquo;t find &ldquo;{query}&rdquo;
              </h3>
              <p className="mt-1 text-xs text-muted leading-normal tracking-tight">
                Know this reviewer?
              </p>
              <button
                type="button"
                onClick={() => openModalWithQuery(query)}
                className="mt-4 w-full sm:w-auto inline-flex h-11 md:h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-background px-6 text-[13px] md:text-[15px] font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 tracking-tight"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Request Reviewer</span>
              </button>
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
