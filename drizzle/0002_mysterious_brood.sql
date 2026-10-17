ALTER TABLE "tournament_teams" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "event_slug" text;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_event_slug_events_slug_fk" FOREIGN KEY ("event_slug") REFERENCES "public"."events"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_teams_user_idx" ON "tournament_teams" USING btree ("tournament_id","user_id");