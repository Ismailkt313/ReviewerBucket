import Link from "next/link";
import type { Reviewer } from "@/app/data/reviewers";

type ReviewerCardProps = {
  reviewer: Reviewer;
};

export default function ReviewerCard({ reviewer }: ReviewerCardProps) {
  return (
    <Link
      href={`/reviewers/${reviewer.slug}`}
      role="listitem"
      className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-5 transition-[border-color,box-shadow] duration-150 hover:border-neutral-400 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none dark:hover:border-neutral-500"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold text-foreground">
          {reviewer.name}
        </span>
        <span className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-0.5 font-mono text-xs font-medium text-secondary">
          {reviewer.code}
        </span>
      </div>
    </Link>
  );
}
