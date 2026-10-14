import { defineConfig } from "drizzle-kit";

// Node 20.12+ / 21.7+ ship env-file loading; keep the failure silent so
// `drizzle-kit generate` (which needs no DB) works without a .env file.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env yet — generate does not need one */
}

export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
