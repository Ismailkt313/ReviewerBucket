import type { MetadataRoute } from "next";
import { siteConfig } from "./config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/socket.io/", "/_next/"],
      },
      {
        userAgent: ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot"],
        allow: "/",
        disallow: ["/api/", "/socket.io/", "/_next/"],
      },
      {
        // Explicitly cater to AI crawlers for AEO / GEO discoverability
        userAgent: ["ChatGPT-User", "GPTBot", "ClaudeBot", "Google-Extended", "PerplexityBot"],
        allow: "/",
        disallow: ["/api/", "/socket.io/", "/_next/"],
      }
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
