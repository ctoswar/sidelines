import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Workspace and token-bearing routes stay out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/player/", "/organizer/", "/admin/", "/api/", "/score/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
