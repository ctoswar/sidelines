CREATE TYPE "public"."division_id" AS ENUM('mens', 'womens', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'past');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('live', 'final', 'next');--> statement-breakpoint
CREATE TYPE "public"."pool_label" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('player', 'organizer');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('live', 'draft');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"event_slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_details" (
	"event_id" text PRIMARY KEY NOT NULL,
	"about" text NOT NULL,
	"venue_name" text NOT NULL,
	"venue_address" text NOT NULL,
	"venue_map_url" text NOT NULL,
	"tz_label" text NOT NULL,
	"tz_offset" integer NOT NULL,
	"has_results" boolean DEFAULT false NOT NULL,
	"days" integer NOT NULL,
	"fields" integer NOT NULL,
	"facts" jsonb NOT NULL,
	"teams" jsonb NOT NULL,
	"matches" jsonb NOT NULL,
	"pools" jsonb NOT NULL,
	"overall" jsonb NOT NULL,
	"bracket" jsonb NOT NULL,
	"players" jsonb NOT NULL,
	"mvp" jsonb NOT NULL,
	"crew" jsonb NOT NULL,
	"announcements" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"code" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" "event_status" NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"live" boolean DEFAULT false NOT NULL,
	"team_count" integer NOT NULL,
	"color" text NOT NULL,
	"monogram" text NOT NULL,
	"has_logo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_crew" (
	"game_id" text PRIMARY KEY NOT NULL,
	"scorekeeper" text DEFAULT '' NOT NULL,
	"umpire" text DEFAULT '' NOT NULL,
	"score_token" text,
	"umpire_token" text
);
--> statement-breakpoint
CREATE TABLE "game_results" (
	"game_id" text PRIMARY KEY NOT NULL,
	"score" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"tournament_id" text NOT NULL,
	"field" text NOT NULL,
	"time" text NOT NULL,
	"team_a" text NOT NULL,
	"team_b" text NOT NULL,
	"score" text DEFAULT '' NOT NULL,
	"status" "game_status" DEFAULT 'next' NOT NULL,
	"division" "division_id" NOT NULL,
	"tier" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_tournaments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"meta" text NOT NULL,
	"fee" text NOT NULL,
	"spots" text NOT NULL,
	"event_slug" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"org_type" text NOT NULL,
	"title" text NOT NULL,
	"volume" text NOT NULL,
	"city" text NOT NULL,
	"site" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_owner_user_id_unique" UNIQUE("owner_user_id")
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"nickname" text DEFAULT '',
	"date_of_birth" text DEFAULT '',
	"gender" text DEFAULT 'Prefer not to say',
	"nationality" text DEFAULT '',
	"city" text DEFAULT '',
	"format" text DEFAULT 'Singles',
	"experience" text DEFAULT 'Recreational',
	"dominant_hand" text DEFAULT 'Right',
	"playing_since" text DEFAULT '',
	"match" text DEFAULT 'Open',
	"number" text DEFAULT '',
	"bio" text DEFAULT '',
	"profile_color" text DEFAULT '#c8ef70',
	"photo_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"event_slug" text NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_players" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"number" integer NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "roster_players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"banner_path" text DEFAULT '' NOT NULL,
	"preset" text DEFAULT 'pitch' NOT NULL,
	"accent" text DEFAULT '#c8ef70' NOT NULL,
	"division" "division_id" DEFAULT 'mens' NOT NULL,
	"seed" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_teams" (
	"tournament_id" text NOT NULL,
	"name" text NOT NULL,
	"pool" "pool_label" NOT NULL,
	"seed" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"meta" text NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"schedule_start" text DEFAULT '09:00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" "role" DEFAULT 'player' NOT NULL,
	"username" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_event_slug_events_slug_fk" FOREIGN KEY ("event_slug") REFERENCES "public"."events"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_event_id_events_slug_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_crew" ADD CONSTRAINT "game_crew_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_tournaments" ADD CONSTRAINT "open_tournaments_event_slug_events_slug_fk" FOREIGN KEY ("event_slug") REFERENCES "public"."events"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_slug_events_slug_fk" FOREIGN KEY ("event_slug") REFERENCES "public"."events"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_event_idx" ON "announcements" USING btree ("event_slug","at");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_live_idx" ON "events" USING btree ("live");--> statement-breakpoint
CREATE UNIQUE INDEX "game_crew_score_token_idx" ON "game_crew" USING btree ("score_token") WHERE "game_crew"."score_token" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_crew_umpire_token_idx" ON "game_crew" USING btree ("umpire_token") WHERE "game_crew"."umpire_token" is not null;--> statement-breakpoint
CREATE INDEX "games_tournament_idx" ON "games" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_email_idx" ON "registrations" USING btree ("event_slug","email");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_teams_slot_idx" ON "tournament_teams" USING btree ("tournament_id","name");