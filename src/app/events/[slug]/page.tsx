import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { EventShell } from "@/components/events/event-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadEventDetail } from "@/server/events";

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
  return { title: `${detail.event.name} – Sidelines` };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await detailFor(slug);
  if (!detail) notFound();

  return (
    <>
      <SiteHeader />
      <main className="event-detail-page px-4 pb-20 pt-5 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <EventShell d={detail} />
          {detail.event.status === "upcoming" && (
            <section className="event-detail-cta mt-12 rounded-2xl p-6 sm:p-8">
              <p className="font-score text-3xl font-bold">Playing in this event?</p>
              <p className="mt-1 text-muted">Log in to register your team or follow your games.</p>
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
