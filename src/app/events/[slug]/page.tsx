import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { EventShell } from "@/components/events/event-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadEventDetail } from "@/server/events";
import { displayPlace, formatRange } from "@/lib/events-data";

// Phase 6: the page renders from Postgres per request (the same loadEventDetail
// the API serves) instead of the static modules it was prerendered from. No
// generateStaticParams - the build never touches the database, and every page
// view sees live registration counts and announcements. cache() dedupes the
// metadata and body reads into one query per request.
const detailFor = cache(loadEventDetail);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await detailFor(slug);
  // notFound() here (not in the body) so the response status is a real 404 -
  // a streamed dynamic body has already flushed 200 by the time it throws.
  if (!detail) notFound();
  const { event, venue } = detail;
  const description =
    `${event.name} — ${formatRange(event.start, event.end)} in ${displayPlace(event.city)}, ${event.country}. ` +
    `${venue.name} · ${detail.fields} courts · Divisions: ${detail.facts.find((f) => f.label === "Divisions")?.value ?? "see event page"}.`;
  return {
    title: `${event.name} – Sidelines`,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      type: "website",
      siteName: "Sidelines",
      title: `${event.name} – Sidelines`,
      description,
      url: `/events/${event.slug}`,
    },
    twitter: { card: "summary", title: `${event.name} – Sidelines`, description },
  };
}

/**
 * SportsEvent structured data from the fields the event page actually has.
 * No offers/prices are asserted — entry fees live in free-text facts, and a
 * wrong price in the markup is worse than none.
 */
function sportsEventJsonLd(d: Awaited<ReturnType<typeof detailFor>>): string {
  if (!d) return "";
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: d.event.name,
    sport: "Pickleball",
    startDate: d.event.start,
    endDate: d.event.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: d.venue.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: displayPlace(d.event.city),
        addressCountry: d.event.code || d.event.country,
      },
    },
    description: d.about,
  }).replace(/</g, "\\u003c");
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await detailFor(slug);
  if (!detail) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sportsEventJsonLd(detail) }}
      />
      <SiteHeader />
      <main className="event-detail-page px-4 pb-20 pt-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <EventShell d={detail} />
          {detail.event.status === "upcoming" && (
            <section className="event-detail-cta mt-12 rounded-2xl p-6 sm:p-8">
              <p className="font-score text-3xl font-bold">Playing in this event?</p>
              <p className="mt-1 text-muted">Log in to register or follow your games.</p>
              <div className="mt-4 flex gap-3">
                <Link href="/login" className="btn btn-pri">Log in</Link>
                <Link href="/signup/player" className="btn">Create player account</Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter className="events-footer" />
    </>
  );
}
