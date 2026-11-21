CREATE TABLE "hub_bookings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"court_id" text NOT NULL,
	"user_id" text,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_courts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"name" text NOT NULL,
	"surface" text DEFAULT 'Pickleball' NOT NULL,
	"indoor" boolean DEFAULT false NOT NULL,
	"hourly_rate" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_events" (
	"hub_id" text NOT NULL,
	"event_slug" text NOT NULL,
	CONSTRAINT "hub_events_hub_id_event_slug_pk" PRIMARY KEY("hub_id","event_slug")
);
--> statement-breakpoint
CREATE TABLE "hub_follows" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"user_id" text,
	"from_name" text NOT NULL,
	"from_email" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_news" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_open_play_signups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"template_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_open_play_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"title" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"court" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'All levels' NOT NULL,
	"capacity" integer DEFAULT 24 NOT NULL,
	"price" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_photos" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#174f37' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports_hubs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'Philippines' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"logo_color" text DEFAULT '#1f6b4a' NOT NULL,
	"cover_color" text DEFAULT '#174f37' NOT NULL,
	"monogram" text DEFAULT '' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"hours" jsonb NOT NULL,
	"coming_soon" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub_bookings" ADD CONSTRAINT "hub_bookings_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bookings" ADD CONSTRAINT "hub_bookings_court_id_hub_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."hub_courts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bookings" ADD CONSTRAINT "hub_bookings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_courts" ADD CONSTRAINT "hub_courts_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_events" ADD CONSTRAINT "hub_events_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_events" ADD CONSTRAINT "hub_events_event_slug_events_slug_fk" FOREIGN KEY ("event_slug") REFERENCES "public"."events"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_follows" ADD CONSTRAINT "hub_follows_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_follows" ADD CONSTRAINT "hub_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_messages" ADD CONSTRAINT "hub_messages_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_messages" ADD CONSTRAINT "hub_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_news" ADD CONSTRAINT "hub_news_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_signups" ADD CONSTRAINT "hub_open_play_signups_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_signups" ADD CONSTRAINT "hub_open_play_signups_template_id_hub_open_play_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."hub_open_play_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_signups" ADD CONSTRAINT "hub_open_play_signups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_templates" ADD CONSTRAINT "hub_open_play_templates_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_photos" ADD CONSTRAINT "hub_photos_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_hubs" ADD CONSTRAINT "sports_hubs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hub_bookings_slot_idx" ON "hub_bookings" USING btree ("court_id","date","start_time");--> statement-breakpoint
CREATE INDEX "hub_bookings_user_idx" ON "hub_bookings" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "hub_bookings_hub_date_idx" ON "hub_bookings" USING btree ("hub_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_courts_slot_idx" ON "hub_courts" USING btree ("hub_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_follows_pair_idx" ON "hub_follows" USING btree ("hub_id","user_id");--> statement-breakpoint
CREATE INDEX "hub_messages_hub_idx" ON "hub_messages" USING btree ("hub_id","created_at");--> statement-breakpoint
CREATE INDEX "hub_news_hub_idx" ON "hub_news" USING btree ("hub_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_open_play_signup_idx" ON "hub_open_play_signups" USING btree ("template_id","date","user_id");--> statement-breakpoint
CREATE INDEX "hub_open_play_session_idx" ON "hub_open_play_signups" USING btree ("template_id","date");--> statement-breakpoint
CREATE INDEX "hub_open_play_hub_idx" ON "hub_open_play_templates" USING btree ("hub_id","weekday");--> statement-breakpoint
CREATE INDEX "hub_photos_hub_idx" ON "hub_photos" USING btree ("hub_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "sports_hubs_slug_idx" ON "sports_hubs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sports_hubs_org_idx" ON "sports_hubs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sports_hubs_city_idx" ON "sports_hubs" USING btree ("city");