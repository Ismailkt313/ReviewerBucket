"use client";

import { useState, useMemo } from "react";
import type { Reviewer } from "@/app/data/reviewers";
import ReviewerCard from "./ReviewerCard";

type ReviewerExplorerProps = {
  reviewers: Reviewer[];
};

function normalizeQuery(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "").trim();
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

export default function ReviewerExplorer({ reviewers }: ReviewerExplorerProps) {
  const [query, setQuery] = useState("");

  const isSearching = query.trim() !== "";

  const filtered = useMemo(
    () => reviewers.filter((r) => matchesReviewer(r, query)),
    [reviewers, query]
  );

  return (
    <>
      <section
        className={`px-4 sm:px-6 lg:px-8 transition-[padding] duration-150 ${
          isSearching ? "pb-4 pt-2 sm:pb-12 sm:pt-4" : "pb-12 pt-4"
        }`}
      >
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <label htmlFor="reviewer-search" className="sr-only">
              Search by code or reviewer name
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="reviewer-search"
                type="text"
                role="searchbox"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search BR 64 or reviewer name"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-12 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted/65 focus:border-neutral-400 focus:ring-4 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="4" y1="4" x2="12" y2="12" />
                    <line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        id="reviewers"
        aria-label="Reviewer directory"
        className={`border-t border-border bg-background px-4 sm:px-6 lg:px-8 transition-[padding] duration-150 ${
          isSearching ? "py-4 sm:py-16" : "py-16"
        }`}
      >
        <div className="mx-auto max-w-7xl">
          <div
            className={`flex items-baseline justify-between border-b border-border pb-4 transition-[margin] duration-150 ${
              isSearching ? "mb-4 sm:mb-8" : "mb-8"
            }`}
          >
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Reviewers
            </h2>
            <span className="text-sm font-medium text-secondary">
              {!isSearching
                ? `${reviewers.length} reviewers available`
                : filtered.length === 1
                ? "1 reviewer found"
                : `${filtered.length} reviewers found`}
            </span>
          </div>

          {filtered.length > 0 ? (
            <div
              role="list"
              className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6"
            >
              {filtered.map((reviewer) => (
                <ReviewerCard key={reviewer.id} reviewer={reviewer} />
              ))}
            </div>
          ) : (
            <div className="mt-6 text-center sm:mt-16">
              <h3 className="text-lg font-bold text-foreground">
                No reviewer found for &ldquo;{query}&rdquo;
              </h3>
              <p className="mt-2 text-sm text-secondary">
                Check the code or try searching without spaces.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
