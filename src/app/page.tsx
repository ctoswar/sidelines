import { EventsBrowser } from "@/components/events/events-browser";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { events } from "@/lib/events-data";

export const metadata = { title: "Sidelines – Ultimate events, live scores and results" };

export default function HomePage() {
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
              <p className="events-eyebrow"><span />The global event desk <b>///</b> Season 26—27</p>
              <h1>Find your next<br /><em>field.</em></h1>
              <p className="events-hero-copy">Every tournament, league and live score in one place. Follow the games that make the journey worth it.</p>
            </div>
            <div className="events-hero-note">
              <p className="events-hero-note-label">Sidelines / Dispatch</p>
              <p className="events-hero-note-text">The whistle is only the beginning.</p>
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
