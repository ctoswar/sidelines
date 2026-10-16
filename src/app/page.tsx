import { EventsBrowser } from "@/components/events/events-browser";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadCatalogue } from "@/server/events";

export const metadata = { title: "Sidelines – Pickleball events, live scores and results" };

// The catalogue is a DB read now (Phase 7), so the landing page renders per
// request — which also keeps `next build` free of any database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await loadCatalogue();
  const liveCount = events.filter((event) => event.live).length;
  const countryCount = new Set(events.map((event) => event.country)).size;

  return (
    <>
      <SiteHeader />
      <main className="events-page">
        <div className="events-page-grid" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <section className="events-hero">
            <div>
              <p className="events-eyebrow"><span />The global event desk <b>{"///"}</b> Season 26—27</p>
              <h1>Find your next<br /><em>court.</em></h1>
              <p className="events-hero-copy">Every pickleball tournament, league and live score in one place. Follow the matches that make the journey worth it.</p>
            </div>
            <div className="events-hero-note">
              <p className="events-hero-note-label">Sidelines / Dispatch</p>
              <p className="events-hero-note-text">The serve is only the beginning.</p>
              <div className="events-hero-stats"><span><b>{events.length}</b> events</span><span><b>{countryCount}</b> countries</span><span><b>{liveCount}</b> live now</span></div>
            </div>
          </section>
          <EventsBrowser events={events} />
        </div>
      </main>
      <SiteFooter className="events-footer" />
    </>
  );
}
