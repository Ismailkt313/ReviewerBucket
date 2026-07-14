import type { MetadataRoute } from "next";
import { siteConfig } from "./config";
import { reviewers } from "./data/reviewers";

export default function sitemap(): MetadataRoute.Sitemap {
  const main = [
    {
      url: `${siteConfig.url}/`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
  ];

  const reviewerUrls = reviewers.map((reviewer) => ({
    url: `${siteConfig.url}/reviewers/${reviewer.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...main, ...reviewerUrls];
}
