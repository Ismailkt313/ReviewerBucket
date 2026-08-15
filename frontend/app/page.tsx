import { Suspense } from "react";
import Header from "./components/Header";
import AnnouncementBar from "./components/AnnouncementBar";
import Hero from "./components/Hero";

import ReviewerExplorer from "./components/ReviewerExplorer";
import HowItWorks from "./components/HowItWorks";
import About from "./components/About";
import CommunitySection from "./components/CommunitySection";
import FAQ from "./components/FAQ";
import { faqs } from "./data/faqs";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import { getApiUrl } from "./utils/api";
import { siteConfig } from "./config";
import type { Reviewer } from "./data/reviewers";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    "description":
      "Find honest interview experiences shared by students for Brototype reviewers. Search reviewers by name, reviewer code or technology stack.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${siteConfig.url}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteConfig.url,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
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
      <AnnouncementBar />
      <main className="flex-1">
        <Hero />
        <Suspense fallback={null}>
          <ReviewerExplorer reviewers={realReviewers} />
        </Suspense>
        <HowItWorks />
        <About />
        <CommunitySection />
        <FAQ />
        <Disclaimer />
      </main>
      <Footer />
      <SpeedInsights />
    </>
  );
}
