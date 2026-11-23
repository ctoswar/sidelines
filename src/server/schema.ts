// Sidelines database schema (PostgreSQL + Drizzle).
//
// This replaces the nine `sidelines.demo.*` localStorage keys. Two worlds live
// side by side, mirroring the app:
//
//   1. Public events (spectator side) — `events` is the queryable catalogue,
//      and `event_details` holds the large generated aggregate (teams, match
//      list, pools, bracket, stats, MVP, crew) that `src/lib/event-detail.ts`
//      used to synthesize per request. That content is read-only fixture data, so
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
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

// `admin` sits above `organizer`: it owns the homepage Spotlight curation and
// cannot be self-assigned through signup (see src/app/api/auth/signup/route.ts).
export const roleEnum = pgEnum("role", ["player", "organizer", "admin"]);
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

/** The generated event aggregate — read-only fixture content, consumed whole. */
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
  /**
   * The division they entered — one of the taxonomy ids (mens | womens |
   * mixed). Null only on rows that predate the picker, which the API maps
   * to "no division chosen" rather than backfilling a guess.
   */
  division: text("division"),
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
  /**
   * The published event this tournament drives — the pool table reads its
   * registrations to seed solo pickleball entrants (see src/server/pool.ts).
   * Null while a draft has no public event yet.
   */
  eventSlug: text("event_slug").references(() => events.slug, { onDelete: "set null" }),
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
  /**
   * Where this entrant came from. Pickleball players register solo, so an
   * entrant is usually one player bridged from the event's registrations
   * ("signups"); it can also be a manually added team or a CSV row. Tracked so
   * re-running the bridge is idempotent and the table can show provenance.
   */
  source: text("source").default("manual").notNull(),
  /**
   * The registrant account this entrant was bridged from, when there is one.
   * onDelete "set null" keeps the pool row if the account later goes away.
   */
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
}, (t) => [
  uniqueIndex("tournament_teams_slot_idx").on(t.tournamentId, t.name),
  index("tournament_teams_user_idx").on(t.tournamentId, t.userId),
]);

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
  /** One team per owner; Phase 2 auth landed, so every row has a real user. */
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
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

// ---------- discovery: public SportsHubs ----------
//
// A SportsHub is the public face of a club or venue: the thing a player
// browses in Discover, follows, books a court at, and checks for open play.
// It is deliberately separate from `organizations` (which owns tournaments
// and is tied to one signed-in organizer) because a hub can exist before an
// organizer claims it, and several organizers can share one venue.
//
// `organizationId` links a claimed hub to the workspace that publishes its
// events; seeded community hubs leave it null and use `hubEvents` instead.

export type HubOperatingHours = {
  /** "Monday" … "Sunday". */
  day: string;
  /** Display labels, e.g. "6am". */
  open: string;
  close: string;
  closed?: boolean;
};

export const sportsHubs = pgTable(
  "sports_hubs",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    about: text("about").default("").notNull(),
    address: text("address").default("").notNull(),
    city: text("city").default("").notNull(),
    country: text("country").default("Philippines").notNull(),
    phone: text("phone").default("").notNull(),
    email: text("email").default("").notNull(),
    /** Tile / mark colour used across the directory. */
    logoColor: text("logo_color").default("#1f6b4a").notNull(),
    coverColor: text("cover_color").default("#174f37").notNull(),
    monogram: text("monogram").default("").notNull(),
    /** Seeded member base; follows are added on top at read time. */
    memberCount: integer("member_count").default(0).notNull(),
    /** Rough coordinates for the Discover map, not a geocoder. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    hours: jsonb("hours").$type<HubOperatingHours[]>().notNull(),
    /** A hub that is listed but not yet taking bookings or sessions. */
    comingSoon: boolean("coming_soon").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sports_hubs_slug_idx").on(t.slug),
    index("sports_hubs_org_idx").on(t.organizationId),
    index("sports_hubs_city_idx").on(t.city),
  ],
);

export const hubCourts = pgTable(
  "hub_courts",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    surface: text("surface").default("Pickleball").notNull(),
    indoor: boolean("indoor").default(false).notNull(),
    /** Display price for a one-hour slot, e.g. "₱350". */
    hourlyRate: text("hourly_rate").default("").notNull(),
    sort: integer("sort").default(0).notNull(),
  },
  (t) => [uniqueIndex("hub_courts_slot_idx").on(t.hubId, t.name)],
);

export const hubOpenPlayTemplates = pgTable(
  "hub_open_play_templates",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
    weekday: integer("weekday").notNull(),
    title: text("title").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    court: text("court").default("").notNull(),
    level: text("level").default("All levels").notNull(),
    capacity: integer("capacity").default(24).notNull(),
    price: text("price").default("").notNull(),
    active: boolean("active").default(true).notNull(),
  },
  (t) => [index("hub_open_play_hub_idx").on(t.hubId, t.weekday)],
);

export const hubOpenPlaySignups = pgTable(
  "hub_open_play_signups",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => hubOpenPlayTemplates.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** ISO date, YYYY-MM-DD - one row per player per session occurrence. */
    date: text("date").notNull(),
    /**
     * Companion seats booked by the account: "" is the account's own seat,
     * any other value names the guest it was booked for. Capacity counts
     * every row, so a three-player booking takes three seats.
     */
    guestName: text("guest_name").default("").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("hub_open_play_signup_idx").on(t.templateId, t.date, t.userId, t.guestName),
    index("hub_open_play_session_idx").on(t.templateId, t.date),
  ],
);

/**
 * The checkout record behind a paid open-play booking: the fee snapshot,
 * the voucher applied and the total charged. A session's price can change
 * after a player books, so the order stores what was actually agreed.
 */
export const hubOpenPlayOrders = pgTable(
  "hub_open_play_orders",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => hubOpenPlayTemplates.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** ISO date, YYYY-MM-DD - the occurrence this booking paid for. */
    date: text("date").notNull(),
    /** Seats paid for, including the account's own. */
    playerCount: integer("player_count").notNull(),
    /** Names of the guest seats at booking time, in booking order. */
    players: jsonb("players").$type<string[]>().notNull(),
    /** Per-seat session fee, in pesos, as priced when booked. */
    sessionFee: integer("session_fee").notNull(),
    /** What the voucher took off the session subtotal, in pesos. */
    discount: integer("discount").default(0).notNull(),
    voucherCode: text("voucher_code").default("").notNull(),
    convenienceFee: integer("convenience_fee").default(0).notNull(),
    /** What the player paid: sessionFee * playerCount - discount + convenienceFee. */
    total: integer("total").notNull(),
    /** "confirmed" until the player cancels; the convenience fee is not returned. */
    status: text("status").default("confirmed").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("hub_open_play_order_idx").on(t.templateId, t.date, t.userId)],
);

/**
 * Discount codes a hub owner publishes for their open-play sessions. Percent
 * codes take a share off the session subtotal; amount codes take a flat peso
 * value off the whole subtotal.
 */
export const hubVouchers = pgTable(
  "hub_vouchers",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    /** Stored uppercase; lookups normalize before matching. */
    code: text("code").notNull(),
    kind: text("kind").default("percent").notNull(), // "percent" | "amount"
    value: integer("value").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("hub_voucher_code_idx").on(t.hubId, t.code)],
);

export const hubBookings = pgTable(
  "hub_bookings",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    courtId: text("court_id")
      .notNull()
      .references(() => hubCourts.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** ISO date, YYYY-MM-DD. */
    date: text("date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("hub_bookings_slot_idx").on(t.courtId, t.date, t.startTime),
    index("hub_bookings_user_idx").on(t.userId, t.date),
    index("hub_bookings_hub_date_idx").on(t.hubId, t.date),
  ],
);

export const hubFollows = pgTable(
  "hub_follows",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("hub_follows_pair_idx").on(t.hubId, t.userId)],
);

export const hubPhotos = pgTable(
  "hub_photos",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    caption: text("caption").default("").notNull(),
    /** CSS gradient fallback while the venue has no uploaded photo. */
    color: text("color").default("#174f37").notNull(),
    sort: integer("sort").default(0).notNull(),
  },
  (t) => [index("hub_photos_hub_idx").on(t.hubId, t.sort)],
);

export const hubNews = pgTable(
  "hub_news",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
  },
  (t) => [index("hub_news_hub_idx").on(t.hubId, t.publishedAt)],
);

export const hubEvents = pgTable(
  "hub_events",
  {
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug")
      .notNull()
      .references(() => events.slug, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.hubId, t.eventSlug] })],
);

export const hubMessages = pgTable(
  "hub_messages",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    hubId: text("hub_id")
      .notNull()
      .references(() => sportsHubs.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").default("").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("hub_messages_hub_idx").on(t.hubId, t.createdAt)],
);

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

export const sportsHubRelations = relations(sportsHubs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sportsHubs.organizationId],
    references: [organizations.id],
  }),
  courts: many(hubCourts),
  bookings: many(hubBookings),
  follows: many(hubFollows),
  photos: many(hubPhotos),
  news: many(hubNews),
}));

export const hubCourtRelations = relations(hubCourts, ({ one, many }) => ({
  hub: one(sportsHubs, { fields: [hubCourts.hubId], references: [sportsHubs.id] }),
  bookings: many(hubBookings),
}));

export const hubBookingRelations = relations(hubBookings, ({ one }) => ({
  hub: one(sportsHubs, { fields: [hubBookings.hubId], references: [sportsHubs.id] }),
  court: one(hubCourts, { fields: [hubBookings.courtId], references: [hubCourts.id] }),
  user: one(user, { fields: [hubBookings.userId], references: [user.id] }),
}));

export const hubFollowRelations = relations(hubFollows, ({ one }) => ({
  hub: one(sportsHubs, { fields: [hubFollows.hubId], references: [sportsHubs.id] }),
  user: one(user, { fields: [hubFollows.userId], references: [user.id] }),
}));
