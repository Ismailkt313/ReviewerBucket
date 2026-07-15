"use client";

import { useEffect, useRef, useState } from "react";
import type { StudentExperience } from "@/app/data/experiences";

type StudentExperiencesFeedProps = {
  reviewerId: string;
  initialExperiences: StudentExperience[];
};

function formatMonthYear(dateString: string): string {
  const date = new Date(dateString);
  return isNaN(date.getTime())
    ? "Date unknown"
    : date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      });
}

const generateTempId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function StudentExperiencesFeed({
  reviewerId,
  initialExperiences
}: StudentExperiencesFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [experiencesList, setExperiencesList] = useState<StudentExperience[]>(initialExperiences);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = inputText.trim();

    if (trimmed.length < 2) {
      setError("Please write at least 2 characters.");
      return;
    }

    if (trimmed.length > 1000) {
      setError("Written experience cannot exceed 1000 characters.");
      return;
    }

    const newExp: StudentExperience = {
      id: generateTempId(),
      reviewerId,
      content: trimmed,
      status: "approved",
      createdAt: new Date().toISOString()
    };

    setExperiencesList((prev) => [...prev, newExp]);
    setInputText("");
    setError("");

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Student Experiences
        </h2>
        <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs font-semibold text-secondary">
          {experiencesList.length}
        </span>
      </div>

      <div className="border border-border bg-surface rounded-xl flex flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 max-h-[380px] sm:max-h-[480px] scroll-smooth"
        >
          {experiencesList.length > 0 ? (
            experiencesList.map((exp, idx) => (
              <div key={exp.id}>
                {idx > 0 && <div className="border-t border-border/60 my-4" />}
                <div className="flex flex-col gap-2">
                  <p className="text-sm leading-relaxed text-secondary whitespace-pre-line">
                    {exp.content}
                  </p>
                  <div className="flex justify-end text-[11px] text-muted font-medium mt-0.5">
                    <span>{formatMonthYear(exp.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-secondary">
              No student experiences yet.
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background p-4 flex flex-col gap-3">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <label htmlFor="feed-input" className="sr-only">
              Share your experience
            </label>
            <textarea
              id="feed-input"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Share your experience..."
              maxLength={1000}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-neutral-400 focus:ring-2 focus:ring-focus/15 focus:outline-none dark:focus:border-neutral-500 resize-none transition-colors duration-150"
            />

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-[10px] text-muted leading-tight">
                Posted anonymously. Avoid including identifying information.
              </span>
              <div className="flex items-center justify-end gap-3 self-end sm:self-auto">
                <span className="text-[10px] text-muted font-medium font-mono">
                  {inputText.length} / 1000
                </span>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-accent text-background text-xs font-bold border border-accent hover:opacity-90 transition-opacity duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  Post
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
