import { PageHeader } from "@/components/dashboard/page-header";
import { loadSpotlightEvents } from "@/server/admin";
import { describeRange } from "@/lib/tournament-meta";
import { SpotlightActions } from "./spotlight-actions";

export const metadata = { title: "Spotlight – Sidelines" };
export const dynamic = "force-dynamic";

/**
 * The homepage marquee, curated.
 *
 * This page exists because spotlighting used to be an organizer self-service
 * button on /organizer — every promoter could put their own tournament in
 * front of the whole site. It is now the admin's call, and this is the only
 * screen in the app that can make it.
 */
export default async function SpotlightPage() {
  const events = await loadSpotlightEvents();
  const featured = events.filter((event) => event.featured).length;

  return (
    <>
      <PageHeader
        title="Spotlight"
        subtitle={
          events.length
            ? `${events.length} published event${events.length === 1 ? "" : "s"} · ${featured} in the Spotlight`
            : "Nothing published yet"
        }
      />
      <p className="mb-6 max-w-2xl text-sm text-muted">
        The homepage leads with one large card and two beside it, so three is the number that
        fills the marquee. Organizers publish their own tournaments — they just cannot put
        them in front of the site. That part is yours.
      </p>
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {events.map((event) => (
          <div key={event.slug} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{event.name}</p>
              <p className="text-sm text-muted">
                {describeRange(event.start, event.end)}
                {" · "}
                {event.country ? `${event.city}, ${event.country}` : event.city}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${event.live ? "text-flag" : "text-muted"}`}>
                {event.live ? "Live" : "Not live"}
              </span>
              {event.featured && (
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{ background: "var(--desk-acid)", color: "var(--desk-ink)" }}
                >
                  In Spotlight
                </span>
              )}
              <SpotlightActions slug={event.slug} featured={Boolean(event.featured)} />
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <p className="p-4 text-sm text-muted">
            Nothing here yet. An event joins this list the moment an organizer makes its
            tournament live — that publishes it to the public catalogue.
          </p>
        )}
      </div>
    </>
  );
}
