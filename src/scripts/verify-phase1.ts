/**
 * Phase 1 verification: boots a throwaway embedded Postgres, runs the real
 * `db:migrate` + `db:seed` npm scripts against it, then asserts the seeded
 * rows look right. Runs twice over the seed to prove idempotency.
 *
 * Usage: npx tsx src/scripts/verify-phase1.ts
 *
 * This is a local safety net for machines without Docker. The Pi (and any
 * real environment) uses docker-compose.yml + the same npm scripts.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";

const PORT = 55432;
const DB = "sidelines";
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB}`;

function run(command: string) {
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit", env: { ...process.env, DATABASE_URL } });
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: resolve("var", "embedded-pg"),
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: false, // wipe on stop — verification only
    // Windows locales default to WIN1252, which cannot store the peso/yen
    // signs in the seed data. Force UTF-8 to match the Docker image on the Pi.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  console.log("Starting embedded Postgres...");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB);

  try {
    console.log("\n[1/4] migrate");
    run("npx drizzle-kit migrate");

    console.log("\n[2/4] seed");
    run("npx tsx src/scripts/seed.ts");

    console.log("\n[3/4] assert");
    const sql = postgres(DATABASE_URL, { max: 1 });
    try {
      const [users] = await sql`select count(*)::int as n from "user"`;
      const [events] = await sql`select count(*)::int as n from events`;
      const [games] = await sql`select count(*)::int as n from games`;
      const [details] = await sql`
        select jsonb_array_length(matches) as matches, jsonb_array_length(teams) as teams
        from event_details where event_id = 'harbor-spring-open'`;
      const [profile] = await sql`
        select u.username, u.role, p.profile_color, p.city
        from "user" u join player_profiles p on p.user_id = u.id
        where u.email = 'player@example.com'`;
      const [crew] = await sql`select scorekeeper, umpire from game_crew where game_id = 'g1'`;
      const [tournament] = await sql`select status, schedule_start from tournaments where id = 't-harbor-spring-open'`;

      const checks: [string, boolean, unknown][] = [
        ["users seeded", users.n === 2, users.n],
        ["events seeded", events.n === 11, events.n],
        ["games seeded", games.n === 12, games.n],
        ["event detail matches jsonb", details.matches > 0, details.matches],
        ["event detail teams jsonb", details.teams === 8, details.teams],
        ["player profile joined", profile.username === "alex.rivera" && profile.role === "player", profile],
        ["game crew g1", crew.scorekeeper === "Maya Reyes" && crew.umpire === "Jon Park", crew],
        ["live tournament", tournament.status === "live" && tournament.schedule_start === "09:00", tournament],
      ];

      let failed = 0;
      for (const [label, ok, actual] of checks) {
        if (!ok) {
          failed++;
          console.error(`  FAIL  ${label}:`, actual);
        } else {
          console.log(`  ok    ${label}`);
        }
      }
      if (failed > 0) throw new Error(`${failed} assertion(s) failed`);
    } finally {
      await sql.end();
    }

    console.log("\n[4/4] re-seed (idempotency)");
    run("npx tsx src/scripts/seed.ts");
    const sql2 = postgres(DATABASE_URL, { max: 1 });
    try {
      const [users] = await sql2`select count(*)::int as n from "user"`;
      const [games] = await sql2`select count(*)::int as n from games`;
      if (users.n !== 2 || games.n !== 12) {
        throw new Error(`re-seed duplicated rows: users=${users.n} games=${games.n}`);
      }
      console.log("  ok    counts unchanged after re-seed");
    } finally {
      await sql2.end();
    }

    console.log("\nPhase 1 verification passed.");
  } finally {
    console.log("\nStopping embedded Postgres...");
    await pg.stop();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
