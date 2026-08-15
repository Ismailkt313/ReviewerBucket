"use client";

import { useState } from "react";
import { faqs } from "@/app/data/faqs";

export { faqs };

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="border-t border-border px-4 py-16 md:py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-muted font-medium block">
            FAQ
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-secondary leading-relaxed pt-1">
            Find answers about how Reviewer Bucket works, how experiences are shared, and how community participation works.
          </p>
        </div>

        <dl className="divide-y divide-border border-y border-border">
          {faqs.map((faq, index) => (
            <div key={index} className="py-4.5 sm:py-5">
              <dt>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={openIndex === index}
                  className="flex w-full items-center justify-between gap-4 text-left font-medium text-foreground transition-colors duration-150 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                >
                  <span className="text-sm sm:text-base font-semibold text-foreground">
                    {faq.question}
                  </span>
                  <span
                    className="ml-auto flex-shrink-0 text-muted transition-transform duration-200"
                    style={{
                      transform: openIndex === index ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="8" y1="3" x2="8" y2="13" />
                      <line x1="3" y1="8" x2="13" y2="8" />
                    </svg>
                  </span>
                </button>
              </dt>
              {openIndex === index && (
                <dd className="mt-2.5 sm:mt-3 text-sm leading-relaxed text-secondary animate-in fade-in duration-150 pr-8 max-w-3xl">
                  {faq.answer}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
