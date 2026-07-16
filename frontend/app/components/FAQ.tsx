"use client";

import { useState } from "react";

const faqs = [
  {
    question: "What is Reviewer Bucket?",
    answer:
      "Reviewer Bucket is an independent, community-driven reviewer directory and finder created to help Brocamp and Brototype students identify reviewers and prepare for their technical assessments.",
  },
  {
    question: "Who is Reviewer Bucket for?",
    answer:
      "It is designed specifically for Brocamp and Brototype students who want to quickly look up and identify their reviewer, read interview experiences, and share feedback.",
  },
  {
    question: "How do I find my Brocamp or Brototype reviewer?",
    answer:
      "Enter the reviewer's name or code (e.g., BR64) in the search field on the landing page. The matching reviewer card will display instantly, linking to their detailed profile.",
  },
  {
    question: "How are experiences collected?",
    answer:
      "Interview experiences and ratings are shared anonymously by Brocamp and Brototype students who have recently completed their reviews, exams, or assessments.",
  },
  {
    question: "Can anyone add a reviewer?",
    answer:
      "Yes, if a reviewer is not yet listed, any student can submit a reviewer's name and code to the directory so other students can start sharing their experiences.",
  },
  {
    question: "Can anyone share an interview experience?",
    answer:
      "Yes. Any student can anonymously post their interview questions, review experiences, and ratings for any reviewer in our directory.",
  },
  {
    question: "How are ratings calculated?",
    answer:
      "Reviewer ratings are calculated as an average of student-submitted feedback on criteria such as communication, helpfulness, and technical assessment style.",
  },
  {
    question: "Can experiences be edited?",
    answer:
      "Once an interview experience is submitted, it is reviewed for compliance and spam prevention, after which it cannot be directly edited by users to maintain the platform's authenticity.",
  },
  {
    question: "How do I prepare for a Brocamp technical interview or Brototype assessment?",
    answer:
      "You can search for your assigned reviewer by code (e.g. BR64) or name on Reviewer Bucket. Read their profile to understand their core stacks, common questions, assessment style, and prepare accordingly.",
  },
  {
    question: "What is the Reviewer Bucket community?",
    answer:
      "It is an open space where students share real-time discussions, tips, and insights about upcoming viva evaluations, practical assessments, and mock interviews.",
  },
  {
    question: "Can I search BR64 without a space?",
    answer:
      "Yes. The search is case-insensitive and automatically ignores spacing, so searching for 'BR64', 'br 64', or '64' will all locate the same reviewer.",
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h2>
        <dl className="mt-8 divide-y divide-border">
          {faqs.map((faq, index) => (
            <div key={index} className="py-5">
              <dt>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={openIndex === index}
                  className="flex w-full items-start justify-between gap-4 text-left font-medium text-foreground transition-colors duration-150 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <span className="text-sm font-semibold">
                    {faq.question}
                  </span>
                  <span
                    className="ml-auto flex-shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none"
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
                <dd className="mt-3 pr-8 text-sm leading-relaxed text-secondary">
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
