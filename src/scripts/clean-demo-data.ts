/**
 * One-time cleanup for a database that was previously seeded with demo fixtures.
 *
 * Removes the seeded demo accounts, organization, events, tournaments, games,
 * roster, and open tournaments while leaving the schema and any real user data
 * intact. This is useful when transitioning a dev/Pi database to production.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx src/scripts/clean-demo-data.ts
 */

import { inArray } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";
import { events as eventCatalog } from "../lib/events-data";
import { tournaments } from "../lib/mock-data";

const DEMO_USER_EMAILS = ["player@example.com", "organizer@example.com"] as const;
const LIVE_TOURNAMENT_ID = "t-harbor-spring-open";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const demoUsers = await db
    .select({ id: t.user.id })
    .from(t.user)
    .where(inArray(t.user.email, [...DEMO_USER_EMAILS]));

  if (demoUsers.length === 0) {
    console.log("No demo users found — nothing to clean.");
    return;
  }

  const demoUserIds = demoUsers.map((u) => u.id);
  console.log(`Found ${demoUserIds.length} demo user(s). Removing...`);

  // Deleting demo users cascades to session, account, playerProfiles,
  // organizations (ownerUserId cascade), and teamProfiles (userId cascade).
  await db.delete(t.user).where(inArray(t.user.id, demoUserIds));
  console.log("  demo users + linked profiles/sessions/accounts removed");

  // The demo organization was deleted by cascade, but tournaments reference it
  // with onDelete set null, so their organizationId is now NULL. Delete the
  // demo tournaments explicitly; this cascades to tournamentTeams, games,
  // gameCrew, and gameResults.
  const demoTournamentIds = tournaments.map((tr, i) =>
    i === 0 ? LIVE_TOURNAMENT_ID : `t-${slugify(tr.name)}`,
  );
  await db.delete(t.tournaments).where(inArray(t.tournaments.id, demoTournamentIds));
  console.log("  demo tournaments + teams/games/crew/results removed");

  // Delete demo events; cascades to eventDetails, registrations, announcements.
  const demoEventSlugs = eventCatalog.map((e) => e.slug);
  await db.delete(t.events).where(inArray(t.events.slug, demoEventSlugs));
  console.log("  demo events + details/registrations/announcements removed");

  // These tables are not linked by FK to users/events, so clear them directly.
  await db.delete(t.rosterPlayers);
  console.log("  demo roster cleared");

  await db.delete(t.openTournaments);
  console.log("  demo open tournaments cleared");

  console.log("\nDemo data cleanup complete. The database is now empty of fixtures.");
  console.log("Run `npm run db:seed:demo` if you ever need to restore them for development.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
