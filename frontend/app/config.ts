const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const siteConfig = {
  name: "Reviewer Bucket",
  description:
    "Reviewer Bucket helps Brocamp and Brototype students find reviewers by reviewer code or name. Search codes such as BR 64 and quickly identify the matching reviewer.",
  url: rawSiteUrl.endsWith("/") ? rawSiteUrl.slice(0, -1) : rawSiteUrl,
};
