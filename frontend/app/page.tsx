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

type BackendReviewer = {
  id: string;
  name: string;
  code: string;
  slug: string;
  stacks: string[];
};

export default async function Home() {
  let realReviewers: BackendReviewer[] = [];
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

  return (
    <>
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
    </>
  );
}
