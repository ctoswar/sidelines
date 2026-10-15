-- Phase 5: teams become per-user. The shared demo row (user_id NULL) is
-- re-homed onto the demo player account before the column goes NOT NULL, so
-- an already-seeded database migrates without losing the seeded team.
UPDATE "team_profiles" SET "user_id" = 'demo-user-player' WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "team_profiles" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_user_id_unique" UNIQUE("user_id");
