// Reconcile `events.live` with `tournaments.status`.
//
// `events.live` drives every "happening now" surface — the homepage live-now
// counter, the Live badge on an event row, the Live now pill on the event
// page, and the organizer events list. It is written by publishTournamentEvent
// and kept in step by setEventLive, but a database whose events were published
// before that sync existed can drift: the tournament says live while its event
// still reads false, so none of those badges ever light up.
//
// This re-derives the flag from the single source of truth — the live
// tournament — and is safe to re-run: it only writes rows that differ.
//
// Usage:
//   npm run db:sync:live
//   DATABASE_URL=postgresql://... npx tsx src/scripts/sync-event-live.ts

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";

async function main() {
  const tournaments = await db
    .select({ id: t.tournaments.id, name: t.tournaments.name, status: t.tournaments.status, eventSlug: t.tournaments.eventSlug })
    .from(t.tournaments);

  // Exactly one tournament is live at a time (the status routes enforce it),
  // so the live event set is at most one row.
  const liveSlugs = new Set(
    tournaments.filter((row) => row.status === "live").map((row) => row.eventSlug).filter((slug): slug is string => Boolean(slug)),
  );

  const events = await db.select({ slug: t.events.slug, live: t.events.live }).from(t.events);
  let changed = 0;

  for (const event of events) {
    const should = liveSlugs.has(event.slug);
    if (event.live === should) continue;
    await db.update(t.events).set({ live: should }).where(eq(t.events.slug, event.slug));
    console.log(`  ${event.slug}: live ${event.live} -> ${should}`);
    changed += 1;
  }

  if (changed === 0) {
    console.log("events.live already matches tournaments.status — nothing to do.");
  } else {
    console.log(`\nReconciled ${changed} event${changed === 1 ? "" : "s"}. The homepage live-now counter now reflects the live tournament.`);
  }

  const live = tournaments.find((row) => row.status === "live");
  console.log(live ? `Live tournament: ${live.name}` : "No tournament is live.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
