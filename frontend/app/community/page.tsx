import type { Metadata } from "next";
import CommunityClient from "./CommunityClient";
import { siteConfig } from "../config";

export const metadata: Metadata = {
  title: "Reviewer Bucket Community | Brocamp & Brototype Interview Discussions",
  description:
    "Join the Reviewer Bucket student community feed to discuss technical assessments, mock interviews, viva evaluations, and share reviewer feedback.",
  alternates: {
    canonical: "/community",
  },
  openGraph: {
    type: "website",
    title: "Reviewer Bucket Community | Brocamp & Brototype Interview Discussions",
    description:
      "Join the Reviewer Bucket student community feed to discuss technical assessments, mock interviews, viva evaluations, and share reviewer feedback.",
    url: "/community",
    images: [
      {
        url: `${siteConfig.url}/reviwerbucketLogo.png`,
        width: 1536,
        height: 1024,
        alt: "Reviewer Bucket Community Discussion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reviewer Bucket Community | Brocamp & Brototype Interview Discussions",
    description:
      "Join the Reviewer Bucket student community feed to discuss technical assessments, mock interviews, viva evaluations, and share reviewer feedback.",
    images: [`${siteConfig.url}/reviwerbucketLogo.png`],
  },
};

export default function CommunityPage() {
  const pageUrl = `${siteConfig.url}/community`;

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    "url": pageUrl,
    "name": "Reviewer Bucket Community Board",
    "description": "Student discussions about Brocamp and Brototype reviewers and technical interviews.",
    "isPartOf": {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      "url": siteConfig.url,
      "name": "Reviewer Bucket"
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
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Community Feed",
        "item": pageUrl
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <CommunityClient />
    </>
  );
}
