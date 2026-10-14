// Sidelines database schema (PostgreSQL + Drizzle).
//
// This replaces the nine `sidelines.demo.*` localStorage keys. Two worlds live
// side by side, mirroring the app:
//
//   1. Public events (spectator side) — `events` is the queryable catalogue,
//      and `event_details` holds the large generated aggregate (teams, match
//      list, pools, bracket, stats, MVP, crew) that `src/lib/event-detail.ts`
//      used to synthesize per request. That content is read-only demo data, so
//      it stays as jsonb rather than a dozen normalized tables; user-generated
//      content (registrations, announcements) gets real tables.
//
//   2. Organizer tournaments (workspace side) — normalized tables for the
//      schedule, teams, crew and results that the scoring screens mutate.
//
// Better Auth owns `user` / `session` / `account` / `verification`; the column
// shapes below follow its drizzle-adapter contract exactly (snake_case names,
// `emailVerified`, etc). `role` and `username` are registered as additional
// fields in src/server/auth.ts.

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

export const roleEnum = pgEnum("role", ["player", "organizer"]);
export const tournamentStatusEnum = pgEnum("tournament_status", ["live", "draft"]);
export const gameStatusEnum = pgEnum("game_status", ["live", "final", "next"]);
export const eventStatusEnum = pgEnum("event_status", ["upcoming", "past"]);
export const divisionEnum = pgEnum("division_id", ["mens", "womens", "mixed"]);
export const poolEnum = pgEnum("pool_label", ["A", "B"]);

// ---------- Better Auth core ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // registered as additionalFields in the auth config
  role: roleEnum("role").default("player").notNull(),
  username: text("username").unique(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- player + organizer profiles ----------

export const playerProfiles = pgTable("player_profiles", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  nickname: text("nickname").default(""),
  dateOfBirth: text("date_of_birth").default(""),
  gender: text("gender").default("Prefer not to say"),
  nationality: text("nationality").default(""),
  city: text("city").default(""),
  format: text("format").default("Singles"),
  experience: text("experience").default("Recreational"),
  dominantHand: text("dominant_hand").default("Right"),
  playingSince: text("playing_since").default(""),
  match: text("match").default("Open"),
  number: text("number").default(""),
  bio: text("bio").default(""),
  profileColor: text("profile_color").default("#c8ef70"),
  /** Relative path under UPLOAD_DIR — never a data URL. */
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  ownerUserId: text("owner_user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  orgType: text("org_type").notNull(),
  title: text("title").notNull(),
  volume: text("volume").notNull(),
  city: text("city").notNull(),
  site: text("site"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- public events (spectator side) ----------

export const events = pgTable("events", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  code: text("code").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'`),
  status: eventStatusEnum("status").notNull(),
  featured: boolean("featured").default(false).notNull(),
  live: boolean("live").default(false).notNull(),
  teamCount: integer("team_count").notNull(),
  color: text("color").notNull(),
  monogram: text("monogram").notNull(),
  hasLogo: boolean("has_logo").default(true).notNull(),
}, (t) => [
  index("events_status_idx").on(t.status),
  index("events_live_idx").on(t.live),
]);

/** The generated event aggregate — read-only demo content, consumed whole. */
export const eventDetails = pgTable("event_details", {
  eventId: text("event_id")
    .primaryKey()
    .references(() => events.slug, { onDelete: "cascade" }),
  about: text("about").notNull(),
  venueName: text("venue_name").notNull(),
  venueAddress: text("venue_address").notNull(),
  venueMapUrl: text("venue_map_url").notNull(),
  tzLabel: text("tz_label").notNull(),
  tzOffset: integer("tz_offset").notNull(),
  hasResults: boolean("has_results").default(false).notNull(),
  days: integer("days").notNull(),
  fields: integer("fields").notNull(),
  facts: jsonb("facts").$type<{ label: string; value: string }[]>().notNull(),
  teams: jsonb("teams").$type<unknown[]>().notNull(),
  matches: jsonb("matches").$type<unknown[]>().notNull(),
  pools: jsonb("pools").$type<Record<string, unknown>>().notNull(),
  overall: jsonb("overall").$type<unknown[]>().notNull(),
  bracket: jsonb("bracket").$type<unknown[]>().notNull(),
  players: jsonb("players").$type<unknown[]>().notNull(),
  mvp: jsonb("mvp").$type<unknown[]>().notNull(),
  crew: jsonb("crew").$type<unknown[]>().notNull(),
  announcements: text("announcements").array().notNull().default(sql`'{}'`),
});

export const registrations = pgTable("registrations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  eventSlug: text("event_slug")
    .notNull()
    .references(() => events.slug, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("registrations_event_email_idx").on(t.eventSlug, t.email),
]);

export const announcements = pgTable("announcements", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  eventSlug: text("event_slug")
    .notNull()
    .references(() => events.slug, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  author: text("author").notNull(),
  at: timestamp("at").defaultNow().notNull(),
}, (t) => [index("announcements_event_idx").on(t.eventSlug, t.at)]);

// ---------- organizer tournaments (workspace side) ----------

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  meta: text("meta").notNull(),
  status: tournamentStatusEnum("status").default("draft").notNull(),
  /** First slot of the schedule, "HH:MM" 24h — was the schedule-start localStorage key. */
  scheduleStart: text("schedule_start").default("09:00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tournamentTeams = pgTable("tournament_teams", {
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pool: poolEnum("pool").notNull(),
  seed: integer("seed").notNull(),
}, (t) => [uniqueIndex("tournament_teams_slot_idx").on(t.tournamentId, t.name)]);

export const games = pgTable("games", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  time: text("time").notNull(),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  score: text("score").default("").notNull(),
  status: gameStatusEnum("status").default("next").notNull(),
  division: divisionEnum("division").notNull(),
  tier: text("tier").notNull(),
}, (t) => [index("games_tournament_idx").on(t.tournamentId)]);

export const gameCrew = pgTable("game_crew", {
  gameId: text("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  scorekeeper: text("scorekeeper").default("").notNull(),
  umpire: text("umpire").default("").notNull(),
  // Phase 4: capability tokens embedded in the role-specific QR codes.
  scoreToken: text("score_token"),
  umpireToken: text("umpire_token"),
}, (t) => [
  uniqueIndex("game_crew_score_token_idx")
    .on(t.scoreToken)
    .where(sql`${t.scoreToken} is not null`),
  uniqueIndex("game_crew_umpire_token_idx")
    .on(t.umpireToken)
    .where(sql`${t.umpireToken} is not null`),
]);

export const gameResults = pgTable("game_results", {
  gameId: text("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  score: text("score").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// ---------- player workspace ----------

export const teamProfiles = pgTable("team_profiles", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  /** null = the shared demo team; a real owner once auth lands in Phase 2. */
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline").default("").notNull(),
  /** Relative banner path under UPLOAD_DIR, or "" to use `preset`. */
  bannerPath: text("banner_path").default("").notNull(),
  preset: text("preset").default("pitch").notNull(),
  accent: text("accent").default("#c8ef70").notNull(),
  division: divisionEnum("division").default("mens").notNull(),
  seed: integer("seed").default(1).notNull(),
});

export const rosterPlayers = pgTable("roster_players", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull().unique(),
  number: integer("number").notNull(),
  position: text("position").notNull(),
});

export const openTournaments = pgTable("open_tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  meta: text("meta").notNull(),
  fee: text("fee").notNull(),
  spots: text("spots").notNull(),
  eventSlug: text("event_slug").references(() => events.slug, { onDelete: "set null" }),
});

// ---------- relations (for drizzle relational queries) ----------

export const userRelations = relations(user, ({ one, many }) => ({
  playerProfile: one(playerProfiles, { fields: [user.id], references: [playerProfiles.userId] }),
  organization: one(organizations, { fields: [user.id], references: [organizations.ownerUserId] }),
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const playerProfileRelations = relations(playerProfiles, ({ one }) => ({
  user: one(user, { fields: [playerProfiles.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organizations, ({ one }) => ({
  owner: one(user, { fields: [organizations.ownerUserId], references: [user.id] }),
}));

export const eventDetailRelations = relations(eventDetails, ({ one }) => ({
  event: one(events, { fields: [eventDetails.eventId], references: [events.slug] }),
}));

export const tournamentRelations = relations(tournaments, ({ one, many }) => ({
  organization: one(organizations, { fields: [tournaments.organizationId], references: [organizations.id] }),
  teams: many(tournamentTeams),
  games: many(games),
}));

export const gameRelations = relations(games, ({ one }) => ({
  tournament: one(tournaments, { fields: [games.tournamentId], references: [tournaments.id] }),
  crew: one(gameCrew, { fields: [games.id], references: [gameCrew.gameId] }),
  result: one(gameResults, { fields: [games.id], references: [gameResults.gameId] }),
}));
