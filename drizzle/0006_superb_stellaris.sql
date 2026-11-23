CREATE TABLE "hub_open_play_orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"template_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"player_count" integer NOT NULL,
	"players" jsonb NOT NULL,
	"session_fee" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"voucher_code" text DEFAULT '' NOT NULL,
	"convenience_fee" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_vouchers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"hub_id" text NOT NULL,
	"code" text NOT NULL,
	"kind" text DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "hub_open_play_signup_idx";--> statement-breakpoint
ALTER TABLE "hub_open_play_signups" ADD COLUMN "guest_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_open_play_orders" ADD CONSTRAINT "hub_open_play_orders_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_orders" ADD CONSTRAINT "hub_open_play_orders_template_id_hub_open_play_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."hub_open_play_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_open_play_orders" ADD CONSTRAINT "hub_open_play_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_vouchers" ADD CONSTRAINT "hub_vouchers_hub_id_sports_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."sports_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hub_open_play_order_idx" ON "hub_open_play_orders" USING btree ("template_id","date","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_voucher_code_idx" ON "hub_vouchers" USING btree ("hub_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "hub_open_play_signup_idx" ON "hub_open_play_signups" USING btree ("template_id","date","user_id","guest_name");