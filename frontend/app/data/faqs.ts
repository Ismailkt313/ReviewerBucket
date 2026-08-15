export interface FAQItem {
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    question: "What is Reviewer Bucket?",
    answer:
      "A student-focused place to find reviewers and learn from experiences shared by others.",
  },
  {
    question: "Who is Reviewer Bucket for?",
    answer:
      "Students going through Brototype reviews who want to find reviewer information, read experiences, or share what they experienced.",
  },
  {
    question: "How do I find my reviewer?",
    answer:
      "Search using the reviewer code or name shown during your review.",
  },
  {
    question: "Can I search a code like BR64?",
    answer:
      "Yes. Reviewer search accepts reviewer codes and names with or without spaces (e.g. BR64, br 64, or 64).",
  },
  {
    question: "Can I share my review experience?",
    answer:
      "Yes. You can share what you experienced about a reviewer without attaching your real identity to the post.",
  },
  {
    question: "Can anyone add a reviewer?",
    answer:
      "Yes. If an assigned reviewer is not yet listed, you can submit their name and code using the Add Reviewer option.",
  },
  {
    question: "Can I participate in the community?",
    answer:
      "Yes. The Community Chat allows students to discuss Brototype reviews, share tips, and ask questions.",
  },
  {
    question: "Can I talk privately with someone?",
    answer:
      "Yes. Private one-to-one conversations can be started directly from the community space.",
  },
  {
    question: "Can I contact Reviewer Bucket?",
    answer:
      "Yes. You can message the developer directly through the in-app private messaging feature.",
  },
  {
    question: "How are ratings calculated?",
    answer:
      "Ratings are calculated as an average of student-submitted feedback on communication, evaluation style, and helpfulness.",
  },
  {
    question: "Can experiences be edited?",
    answer:
      "Once submitted, experiences are verified for formatting to preserve community authenticity and cannot be directly edited after publication.",
  },
];
