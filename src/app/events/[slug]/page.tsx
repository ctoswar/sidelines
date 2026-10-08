import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventShell } from "@/components/events/event-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { events, getEvent } from "@/lib/events-data";
import { getEventDetail } from "@/lib/event-detail";

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = getEvent(slug);
  return { title: e ? `${e.name} – Sidelines` : "Event – Sidelines" };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = getEventDetail(slug);
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
