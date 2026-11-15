import type { MetadataRoute } from "next";
import { loadCatalogue } from "@/server/events";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Static public routes plus every event page. The catalogue is a database
// read, so this renders per request (like the pages themselves) and the
// catch keeps the build/sitemap usable with the database unreachable.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/contact-us`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms-of-service`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const events = await loadCatalogue();
    return [
      ...staticRoutes,
      ...events.map((event) => ({
        url: `${siteUrl}/events/${event.slug}`,
        lastModified: new Date(`${event.end}T23:59:59Z`),
        changeFrequency: "daily" as const,
        priority: event.live ? 0.9 : 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
