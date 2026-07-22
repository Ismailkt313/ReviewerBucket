import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewerDetailWrapper from "@/app/components/ReviewerDetailWrapper";
import { getApiUrl } from "@/app/utils/api";
import { siteConfig } from "@/app/config";
import type { Reviewer } from "@/app/data/reviewers";

type Props = {
  params: Promise<{ slug: string }>;
};

type BackendExperience = {
  id: string;
  content: string;
  createdAt: string;
};

export async function generateStaticParams() {
  try {
    const res = await fetch(getApiUrl("/api/reviewers"));
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        return json.data.map((r: { slug: string }) => ({
          slug: r.slug
        }));
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(getApiUrl(`/api/reviewers/${slug}`), { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const reviewer: Reviewer = json.data;
        const pageUrl = `${siteConfig.url}/reviewers/${slug}`;
        const title = `${reviewer.name} (${reviewer.code}) Interview Experiences | Reviewer Bucket`;
        const description = `Read honest student interview experiences, ratings, technology stacks, and exam feedback for Brocamp reviewer ${reviewer.name} (${reviewer.code}) on Reviewer Bucket.`;

        return {
          title,
          description,
          alternates: {
            canonical: pageUrl,
          },
          openGraph: {
            type: "profile",
            title,
            description,
            url: pageUrl,
            images: [
              {
                url: `${siteConfig.url}/reviwerbucketLogo.png`,
                width: 1536,
                height: 1024,
                alt: `${reviewer.name} (${reviewer.code}) Reviewer Profile on Reviewer Bucket`,
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [`${siteConfig.url}/reviwerbucketLogo.png`],
          },
        };
      }
    }
  } catch {
    // Ignore
  }
  return {
    title: "Reviewer Details | Reviewer Bucket",
    description: "Look up Brocamp and Brototype reviewer codes, interview experiences, and student ratings."
  };
}

export default async function ReviewerDetailPage({ params }: Props) {
  const { slug } = await params;

  let reviewer: Reviewer | null = null;
  try {
    const res = await fetch(getApiUrl(`/api/reviewers/${slug}`), { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        reviewer = json.data;
      }
    }
  } catch {
    // Ignore
  }

  if (!reviewer) {
    notFound();
  }

  let averageRating: number | null = null;
  let ratingCount = 0;
  let initialExperiences: BackendExperience[] = [];
  let initialNextCursor: string | null = null;
  let initialHasMore = false;

  try {
    const [ratingRes, expRes] = await Promise.all([
      fetch(getApiUrl(`/api/reviewers/${reviewer.id}/rating-summary`), { cache: "no-store" }),
      fetch(getApiUrl(`/api/reviewers/${reviewer.id}/experiences`), { cache: "no-store" })
    ]);

    if (ratingRes.ok) {
      const ratingJson = await ratingRes.json();
      if (ratingJson && ratingJson.data) {
        averageRating = ratingJson.data.averageRating;
        ratingCount = ratingJson.data.ratingCount;
      }
    }

    if (expRes.ok) {
      const expJson = await expRes.json();
      if (expJson && expJson.data) {
        initialExperiences = expJson.data.experiences || [];
        initialNextCursor = expJson.data.nextCursor || null;
        initialHasMore = expJson.data.hasMore || false;
      }
    }
  } catch {
    // Ignore
  }

  const pageUrl = `${siteConfig.url}/reviewers/${slug}`;
  const stackName = reviewer.stacks.join(", ") || "General Stack";

  // Dynamic AEO/GEO Summary block
  const summaryText = `${reviewer.name} (Reviewer Code: ${reviewer.code}) is a technical interviewer associated with the ${stackName} stack for Brocamp and Brototype programs. Students have contributed ratings, shared interview experiences, and listed assessment feedback to help future candidates prepare for their Brocamp technical evaluations, practical exams, and mock vivas.`;

  // Structured Data definitions
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteConfig.url
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `${reviewer.name} (${reviewer.code})`,
        "item": pageUrl
      }
    ]
  };

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${pageUrl}#person`,
    "name": reviewer.name,
    "alternateName": reviewer.code,
    "jobTitle": "Technical Interview Reviewer",
    "worksFor": {
      "@type": "Organization",
      "name": "Brocamp & Brototype Student Network"
    },
    "url": pageUrl,
    "image": `${siteConfig.url}/reviwerbucketLogo.png`,
    "knowsAbout": reviewer.stacks
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Who is ${reviewer.name} (${reviewer.code}) reviewer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${reviewer.name} is a technical interviewer associated with the ${stackName} stack for Brocamp and Brototype programs. Students share experiences to help each other prepare for vivas and practical tests.`
        }
      },
      {
        "@type": "Question",
        "name": `What is the average student rating for ${reviewer.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${reviewer.name} (${reviewer.code}) has an average student rating of ${averageRating ? `${averageRating.toFixed(1)}/5` : "5.0/5"} based on ${ratingCount} submitted ratings.`
        }
      },
      {
        "@type": "Question",
        "name": `How do I prepare for a technical interview with ${reviewer.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Review their profile stack (${stackName}) and read past candidate experiences to identify core technical topics, common review questions, and evaluation patterns.`
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Visually hidden but indexable summary block for AI Crawlers (AEO / GEO) */}
      <section className="sr-only" aria-label="Profile Overview">
        <h2>About Reviewer {reviewer.name} ({reviewer.code})</h2>
        <p>{summaryText}</p>
        <div>
          <h3>Associated Stacks</h3>
          <ul>
            {reviewer.stacks.map(s => <li key={s}>{s}</li>)}
          </ul>
        </div>
      </section>

      <ReviewerDetailWrapper
        reviewer={reviewer}
        averageRating={averageRating}
        ratingCount={ratingCount}
        initialExperiences={initialExperiences}
        initialNextCursor={initialNextCursor}
        initialHasMore={initialHasMore}
      />
    </>
  );
}
