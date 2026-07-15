import Header from "./components/Header";
import Hero from "./components/Hero";
import ReviewerExplorer from "./components/ReviewerExplorer";
import HowItWorks from "./components/HowItWorks";
import About from "./components/About";
import FAQ from "./components/FAQ";
import Disclaimer from "./components/Disclaimer";
import Footer from "./components/Footer";
import { reviewers } from "./data/reviewers";

export default function Home() {
  const realReviewers = reviewers.filter((r) => r.id !== "test-reviewer");

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <ReviewerExplorer reviewers={realReviewers} />
        <HowItWorks />
        <About />
        <FAQ />
        <Disclaimer />
      </main>
      <Footer />
    </>
  );
}
