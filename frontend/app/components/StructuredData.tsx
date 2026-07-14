import { siteConfig } from "../config";

export default function StructuredData() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Reviewer Bucket",
    description:
      "A student-focused utility for Brocamp and Brototype students to find reviewers by code or name.",
    url: siteConfig.url,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Reviewer Bucket?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Reviewer Bucket is a simple reviewer finder created to help students identify reviewers using the reviewer codes shown during reviews.",
        },
      },
      {
        "@type": "Question",
        name: "Who is Reviewer Bucket for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It is designed specifically for Brocamp and Brototype students who want to quickly look up and identify their reviewer.",
        },
      },
      {
        "@type": "Question",
        name: "What is a reviewer code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A reviewer code (such as BR 64, BR 54, or AS 33) is the unique identifier shown on screen during your review to designate the reviewer.",
        },
      },
      {
        "@type": "Question",
        name: "How do I find a reviewer by code?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Enter the code into the search field on the landing page. The matching reviewer will be instantly filtered and displayed.",
        },
      },
      {
        "@type": "Question",
        name: "Can I search BR64 without a space?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The search is case-insensitive and automatically ignores spacing, so searching for 'BR64', 'br 64', or '64' will all locate the same reviewer.",
        },
      },
      {
        "@type": "Question",
        name: "Can I search by reviewer name?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. You can enter the reviewer's full or partial name in the search box to find their reviewer code.",
        },
      },
      {
        "@type": "Question",
        name: "Is Reviewer Bucket an official Brocamp or Brototype platform?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Reviewer Bucket is an independent, student-built utility. It is not an official Brocamp or Brototype platform and has no official affiliation with either program.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
