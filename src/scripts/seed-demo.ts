/**
 * Development-only fixture script. Seeds the database with the sample content
 * from the repo so local development and the verify-phase harnesses have data
 * to exercise without creating everything by hand.
 *
 *   - events + event_details  <- src/lib/events-data.ts, src/lib/event-detail.ts
 *   - tournaments/teams/games/crew <- src/lib/mock-data.ts
 *   - team profile <- src/lib/team; roster, open tournaments <- mock-data
 *   - two fixture accounts (player + organizer) with DEMO_PASSWORD
 *
 * Idempotent: every insert upserts on its natural key, so re-running after
 * changing the generators refreshes the seed data without duplicating rows.
 *
 * Usage:  npm run db:seed:demo   (requires migrations to be applied first)
 */

// .env is loaded by src/server/db.ts, which this script imports below.
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";
import { getEventDetail } from "../lib/event-detail";
import { events as eventCatalog } from "../lib/events-data";
import { DEFAULT_PLAYER_PROFILE } from "../lib/player-profile";
import { games, keepers, openTournaments, roster, teams, tournaments, MY_TEAM } from "../lib/mock-data";
import { DEFAULT_TEAM } from "../lib/team";
import { DEFAULT_PRESET } from "../lib/team-banner";

const DEMO_PLAYER_ID = "demo-user-player";
const DEMO_ORGANIZER_ID = "demo-user-organizer";
const DEMO_ORG_ID = "demo-org";
/** The mock schedule belongs to the one live tournament. */
const LIVE_TOURNAMENT_ID = "t-harbor-spring-open";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function seedAccounts(password: string) {
  const passwordHash = await hashPassword(password);

  await db
    .insert(t.user)
    .values([
      {
        id: DEMO_PLAYER_ID,
        name: DEFAULT_PLAYER_PROFILE.name,
        email: DEFAULT_PLAYER_PROFILE.email,
        emailVerified: true,
        role: "player",
        username: DEFAULT_PLAYER_PROFILE.username,
      },
      {
        id: DEMO_ORGANIZER_ID,
        name: "Sam Organizer",
        email: "organizer@example.com",
        emailVerified: true,
        role: "organizer",
        username: "sam.organizer",
      },
    ])
    .onConflictDoUpdate({
      target: t.user.email,
      set: { name: sql`excluded.name`, role: sql`excluded.role`, username: sql`excluded.username` },
    });

  await db
    .insert(t.account)
    .values([
      {
        id: "demo-account-player",
        accountId: DEMO_PLAYER_ID,
        providerId: "credential",
        userId: DEMO_PLAYER_ID,
        password: passwordHash,
      },
      {
        id: "demo-account-organizer",
        accountId: DEMO_ORGANIZER_ID,
        providerId: "credential",
        userId: DEMO_ORGANIZER_ID,
        password: passwordHash,
      },
    ])
    .onConflictDoUpdate({ target: t.account.id, set: { password: passwordHash } });

  await db
    .insert(t.playerProfiles)
    .values({
      userId: DEMO_PLAYER_ID,
      nickname: DEFAULT_PLAYER_PROFILE.nickname,
      dateOfBirth: DEFAULT_PLAYER_PROFILE.dateOfBirth,
      gender: DEFAULT_PLAYER_PROFILE.gender,
      nationality: DEFAULT_PLAYER_PROFILE.nationality,
      city: DEFAULT_PLAYER_PROFILE.city,
      format: DEFAULT_PLAYER_PROFILE.format,
      experience: DEFAULT_PLAYER_PROFILE.experience,
      dominantHand: DEFAULT_PLAYER_PROFILE.dominantHand,
      playingSince: DEFAULT_PLAYER_PROFILE.playingSince,
      match: DEFAULT_PLAYER_PROFILE.match,
      number: DEFAULT_PLAYER_PROFILE.number,
      bio: DEFAULT_PLAYER_PROFILE.bio,
      profileColor: DEFAULT_PLAYER_PROFILE.profileColor,
    })
    .onConflictDoUpdate({
      target: t.playerProfiles.userId,
      set: { nickname: DEFAULT_PLAYER_PROFILE.nickname, bio: DEFAULT_PLAYER_PROFILE.bio },
    });

  await db
    .insert(t.organizations)
    .values({
      id: DEMO_ORG_ID,
      ownerUserId: DEMO_ORGANIZER_ID,
      name: "Sidelines Demo Club",
      orgType: "Club",
      title: "Tournament director",
      volume: "3 to 5",
      city: "Manila, Philippines",
    })
    .onConflictDoUpdate({ target: t.organizations.ownerUserId, set: { name: "Sidelines Demo Club" } });
}

async function seedEvents() {
  for (const e of eventCatalog) {
    await db
      .insert(t.events)
      .values({
        slug: e.slug,
        name: e.name,
        startDate: e.start,
        endDate: e.end,
        city: e.city,
        country: e.country,
        code: e.code,
        tags: e.tags,
        status: e.status,
        featured: e.featured ?? false,
        live: e.live ?? false,
        teamCount: e.teams,
        color: e.color,
        monogram: e.monogram,
        hasLogo: e.hasLogo,
      })
      .onConflictDoUpdate({
        target: t.events.slug,
        set: {
          name: e.name,
          startDate: e.start,
          endDate: e.end,
          status: e.status,
          featured: e.featured ?? false,
          live: e.live ?? false,
          teamCount: e.teams,
        },
      });

    const detail = getEventDetail(e.slug);
    if (!detail) continue;

    await db
      .insert(t.eventDetails)
      .values({
        eventId: e.slug,
        about: detail.about,
        venueName: detail.venue.name,
        venueAddress: detail.venue.address,
        venueMapUrl: detail.venue.mapUrl,
        tzLabel: detail.tz.label,
        tzOffset: detail.tz.offset,
        hasResults: detail.hasResults,
        days: detail.days,
        fields: detail.fields,
        facts: detail.facts,
        teams: detail.teams,
        matches: detail.matches,
        pools: detail.pools,
        overall: detail.overall,
        bracket: detail.bracket,
        players: detail.players,
        mvp: detail.mvp,
        crew: detail.crew,
        announcements: detail.announcements,
      })
      .onConflictDoUpdate({
        target: t.eventDetails.eventId,
        set: { about: detail.about, matches: detail.matches, announcements: detail.announcements },
      });
  }
}

async function seedTournaments() {
  // The live tournament owns the demo schedule; the rest are drafts.
  await db
    .insert(t.tournaments)
    .values(
      tournaments.map((tr, i) => ({
        id: i === 0 ? LIVE_TOURNAMENT_ID : `t-${slugify(tr.name)}`,
        organizationId: DEMO_ORG_ID,
        name: tr.name,
        meta: tr.meta,
        status: tr.status === "Live" ? ("live" as const) : ("draft" as const),
      })),
    )
    .onConflictDoUpdate({
      target: t.tournaments.id,
      set: { name: sql`excluded.name`, meta: sql`excluded.meta`, status: sql`excluded.status` },
    });

  await db
    .insert(t.tournamentTeams)
    .values(
      teams.map((team) => ({ tournamentId: LIVE_TOURNAMENT_ID, name: team.name, pool: team.pool, seed: team.seed })),
    )
    .onConflictDoNothing();

  await db
    .insert(t.games)
    .values(
      games.map((game) => ({
        id: game.id,
        tournamentId: LIVE_TOURNAMENT_ID,
        field: game.field,
        time: game.time,
        teamA: game.teamA,
        teamB: game.teamB,
        score: game.score,
        status: game.status,
        division: game.division,
        tier: game.tier,
      })),
    )
    .onConflictDoUpdate({
      target: t.games.id,
      set: {
        field: sql`excluded.field`,
        time: sql`excluded.time`,
        teamA: sql`excluded.team_a`,
        teamB: sql`excluded.team_b`,
        score: sql`excluded.score`,
        status: sql`excluded.status`,
      },
    });

  // Results are runtime state, not seed content: scoring writes them at runtime
  // (QR tokens, organizer score page), so re-seeding drops them to restore the
  // mock schedule above.
  await db.delete(t.gameResults);

  // Crew rows start with the seeded keeper names; tokens arrive in Phase 4.
  const crewByGame = new Map<string, { scorekeeper: string; umpire: string }>();
  for (const keeper of keepers) {
    if (!keeper.gameId) continue;
    const current = crewByGame.get(keeper.gameId) ?? { scorekeeper: "", umpire: "" };
    if (keeper.role === "Scorer") current.scorekeeper = keeper.name;
    else current.umpire = keeper.name;
    crewByGame.set(keeper.gameId, current);
  }
  await db
    .insert(t.gameCrew)
    .values([...crewByGame].map(([gameId, crew]) => ({ gameId, ...crew })))
    .onConflictDoNothing();
}

async function seedPlayerWorkspace() {
  await db
    .insert(t.teamProfiles)
    .values({
      id: "demo-team-profile",
      userId: DEMO_PLAYER_ID,
      name: MY_TEAM,
      tagline: DEFAULT_TEAM.tagline,
      preset: DEFAULT_PRESET,
      accent: DEFAULT_TEAM.accent,
      division: DEFAULT_TEAM.division,
      seed: DEFAULT_TEAM.seed,
    })
    // One row per owner (Phase 5 made user_id unique): update whatever row
    // the demo player already owns rather than inserting a second one.
    .onConflictDoUpdate({
      target: t.teamProfiles.userId,
      set: { name: DEFAULT_TEAM.name, accent: DEFAULT_TEAM.accent },
    });

  await db
    .insert(t.rosterPlayers)
    .values(roster.map((player) => ({ name: player.name, number: player.number, position: player.position })))
    .onConflictDoNothing();

  await db
    .insert(t.openTournaments)
    .values(
      openTournaments.map((open) => ({
        id: slugify(open.name),
        name: open.name,
        meta: open.meta,
        fee: open.fee,
        spots: open.spots,
        eventSlug: open.slug ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: t.openTournaments.id,
      set: { name: sql`excluded.name`, meta: sql`excluded.meta`, spots: sql`excluded.spots` },
    });
}

async function main() {
  const password = process.env.DEMO_PASSWORD ?? "sidelines-demo";

  await seedAccounts(password);
  await seedEvents();
  await seedTournaments();
  await seedPlayerWorkspace();

  const [{ count: userCount }] = await db.select({ count: sql`count(*)` }).from(t.user);
  const [{ count: eventCount }] = await db.select({ count: sql`count(*)` }).from(t.events);
  const [{ count: gameCount }] = await db.select({ count: sql`count(*)` }).from(t.games);

  console.log("Demo seed complete.");
  console.log(`  users: ${userCount}  events: ${eventCount}  games: ${gameCount}`);
  console.log(`  fixture logins (password: ${password}):`);
  console.log(`    player@example.com    (player)`);
  console.log(`    organizer@example.com (organizer)`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
