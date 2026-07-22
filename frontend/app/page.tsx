import { Suspense } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ReviewerExplorer from "./components/ReviewerExplorer";
import HowItWorks from "./components/HowItWorks";
import About from "./components/About";
import FAQ from "./components/FAQ";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import { getApiUrl } from "./utils/api";
import { siteConfig } from "./config";
import type { Reviewer } from "./data/reviewers";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let realReviewers: Reviewer[] = [];
  try {
    const res = await fetch(getApiUrl("/api/reviewers"), { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        realReviewers = json.data;
      }
    }
  } catch {
    // Fall back to empty list
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    "url": siteConfig.url,
    "name": "Reviewer Bucket",
    "description": "Find honest interview experiences shared by students for Brocamp reviewers. Search reviewers by name, reviewer code or technology stack.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteConfig.url}/?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteConfig.url
      }
    ]
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Reviewer Bucket?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Reviewer Bucket is an independent, community-driven reviewer directory and finder created to help Brocamp and Brototype students identify reviewers and prepare for their technical assessments."
        }
      },
      {
        "@type": "Question",
        "name": "Who is Reviewer Bucket for?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It is designed specifically for Brocamp and Brototype students who want to quickly look up and identify their reviewer, read interview experiences, and share feedback."
        }
      },
      {
        "@type": "Question",
        "name": "How do I find my Brocamp or Brototype reviewer?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Enter the reviewer's name or code (e.g., BR64) in the search field on the landing page. The matching reviewer card will display instantly, linking to their detailed profile."
        }
      },
      {
        "@type": "Question",
        "name": "How are experiences collected?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Interview experiences and ratings are shared anonymously by Brocamp and Brototype students who have recently completed their reviews, exams, or assessments."
        }
      },
      {
        "@type": "Question",
        "name": "Can anyone add a reviewer?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, if a reviewer is not yet listed, any student can submit a reviewer's name and code to the directory so other students can start sharing their experiences."
        }
      },
      {
        "@type": "Question",
        "name": "Can anyone share an interview experience?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Any student can anonymously post their interview questions, review experiences, and ratings for any reviewer in our directory."
        }
      },
      {
        "@type": "Question",
        "name": "How are ratings calculated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Reviewer ratings are calculated as an average of student-submitted feedback on criteria such as communication, helpfulness, and technical assessment style."
        }
      },
      {
        "@type": "Question",
        "name": "Can experiences be edited?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Once an interview experience is submitted, it is reviewed for compliance and spam prevention, after which it cannot be directly edited by users to maintain the platform's authenticity."
        }
      },
      {
        "@type": "Question",
        "name": "How do I prepare for a Brocamp technical interview or Brototype assessment?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can search for your assigned reviewer by code (e.g. BR64) or name on Reviewer Bucket. Read their profile to understand their core stacks, common questions, assessment style, and prepare accordingly."
        }
      },
      {
        "@type": "Question",
        "name": "What is the Reviewer Bucket community?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It is an open space where students share real-time discussions, tips, and insights about upcoming viva evaluations, practical assessments, and mock interviews."
        }
      },
      {
        "@type": "Question",
        "name": "Can I search BR64 without a space?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. The search is case-insensitive and automatically ignores spacing, so searching for 'BR64', 'br 64', or '64' will all locate the same reviewer."
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Header />
      <main className="flex-1">
        <Hero />
        <Suspense fallback={null}>
          <ReviewerExplorer reviewers={realReviewers} />
        </Suspense>
        <HowItWorks />
        <About />
        <FAQ />
        <Disclaimer />
      </main>
      <Footer />
      <SpeedInsights />
    </>
  );
}
