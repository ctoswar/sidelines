// Drizzle client singleton.
//
// postgres.js connects lazily, so importing this module never opens a
// connection during `next build`. The globalThis cache keeps dev hot-reload
// from leaking a connection pool per reload.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Module imports hoist above any code in importing scripts, so .env has to be
// loaded here — before createDb() runs — not in each script's entry point.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env yet — the error below explains what to do */
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance.",
    );
  }
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type Database = Db;
