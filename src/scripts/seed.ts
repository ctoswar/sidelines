/**
 * Production-safe database seed.
 *
 * The app is designed to start from an empty database: organizers and players
 * create real accounts, organizations, tournaments, and events through the UI.
 * No demo fixtures are inserted by default.
 *
 * For local development and the verify-phase harnesses, use:
 *   npm run db:seed:demo
 */

import { sql } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";

async function main() {
  const [{ count: userCount }] = await db.select({ count: sql`count(*)` }).from(t.user);
  console.log("Production seed: nothing to insert.");
  console.log(`  Current user count: ${userCount ?? 0}`);
  console.log("  Run `npm run db:seed:demo` to load development fixtures.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
