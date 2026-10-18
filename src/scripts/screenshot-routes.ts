/**
 * Screenshot the routes that have no screen in the Figma file, at the exact
 * frame sizes the designs use (workspace 2124×1066, phone 390×844), so the
 * renders can be dropped next to the designs for a pixel-level comparison.
 *
 * The organizer routes are behind Better Auth, so this logs in with
 * DEMO_EMAIL / DEMO_PASSWORD. The QR scoring pair needs a capability token:
 * one is minted for a scheduled game (the same rotation the organizer's
 * "Generate" button does). Minting inserts a `game_crew` row — there is no
 * delete endpoint, so drop it by hand (or via `npm run db:seed`) afterwards
 * if the schedule was crew-less before.
 *
 * Usage:  npm run dev         (in one shell)
 *         npx tsx src/scripts/screenshot-routes.ts
 *         DEMO_EMAIL=you@example.com DEMO_PASSWORD=... npx tsx ...
 *
 * PNGs land in var/screenshots/ (gitignored). Override with APP_URL,
 * OUT_DIR, DEMO_EMAIL or DEMO_PASSWORD.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? path.join("var", "screenshots");
const EMAIL = process.env.DEMO_EMAIL ?? "organizer@example.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";

/** Matches the Figma design frames so the renders overlay them 1:1. */
const WORKSPACE_VIEWPORT = { width: 2124, height: 1066 };
const PHONE_VIEWPORT = { width: 390, height: 844 };

const WORKSPACE_ROUTES: Array<[file: string, route: string]> = [
  ["org-events", "/organizer/events"],
  ["org-score", "/organizer/score"],
  ["org-new", "/organizer/tournaments/new"],
];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  // The password field's Show/Hide toggle lives inside the form too, so target
  // the submit button by its label (it carries no type attribute).
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function capture(page: Page, route: string, file: string): Promise<void> {
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  // Entrance animations (score-reveal) and web fonts need a beat to settle.
  await page.waitForTimeout(1_200);
  // The dev indicator would otherwise be baked into the render.
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.screenshot({ path: file, animations: "disabled" });
  console.log(`  ${path.basename(file)}  <-  ${route}`);
}

/**
 * A game to mint against: the crew feed when it already has rows, otherwise
 * the scorekeepers page's game select (a fresh schedule has no crew rows yet).
 */
async function pickGameId(page: Page): Promise<string | null> {
  const fromCrewFeed = await page.evaluate(async () => {
    const res = await fetch("/api/score/games");
    if (!res.ok) return null;
    const data = (await res.json()) as { crew?: Record<string, unknown> };
    return Object.keys(data.crew ?? {})[0] ?? null;
  });
  if (fromCrewFeed) return fromCrewFeed;

  // Fresh schedule: no crew rows yet. The scorekeepers game select only
  // renders once there is more than one game, so fall back to the schedule
  // page — its game modal holds the "Open scorecard" link with the id.
  await page.goto(`${BASE}/organizer/scorekeepers`, { waitUntil: "load" });
  const fromSelect = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
    for (const select of selects) {
      const value = Array.from(select.options).map((o) => o.value).find((v) => v.trim().length > 0);
      if (value) return value;
    }
    return null;
  });
  if (fromSelect) return fromSelect;

  await page.goto(`${BASE}/organizer/schedule`, { waitUntil: "load" });
  const row = page.locator('button:has-text(" vs ")').first();
  if ((await row.count()) === 0) return null;
  await row.click();
  const href = await page
    .locator('a[href*="/organizer/score?game="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return null;
  return new URL(href, BASE).searchParams.get("game");
}

/**
 * Mint (rotate) a scorekeeper token for the picked game, returning it once.
 * Callers are expected to delete the inserted crew row afterwards — see the
 * header note.
 */
async function mintToken(page: Page): Promise<{ id: string; token?: string } | null> {
  const id = await pickGameId(page);
  if (!id) return null;

  const tokens = await page.evaluate(async (gameId) => {
    const res = await fetch(`/api/score/games/${encodeURIComponent(gameId)}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scorekeeper: "A. Rivera", umpire: "M. Santos" }),
    });
    return res.ok ? ((await res.json()) as { scoreToken?: string }) : {};
  }, id);
  return { id, token: tokens.scoreToken };
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const workspace = await browser.newContext({ viewport: WORKSPACE_VIEWPORT, deviceScaleFactor: 1 });
    const page = await workspace.newPage();

    console.log(`Organizer session: ${EMAIL}`);
    await login(page);
    for (const [file, route] of WORKSPACE_ROUTES) await capture(page, route, path.join(OUT, `${file}.png`));

    const game = await mintToken(page);
    if (!game) {
      console.warn("No games on the schedule — skipping the QR scoring pair.");
    } else {
      const phone = await browser.newContext({ viewport: PHONE_VIEWPORT, deviceScaleFactor: 1 });
      const mobile = await phone.newPage();
      if (game.token) {
        await capture(mobile, `/score/${game.id}?t=${encodeURIComponent(game.token)}`, path.join(OUT, "qr-valid.png"));
      } else {
        console.warn("Token mint returned nothing — skipping the valid-link render.");
      }
      await capture(mobile, `/score/${game.id}`, path.join(OUT, "qr-invalid.png"));
      await phone.close();
      await workspace.close();
    }
    console.log(`\nScreenshots in ${path.resolve(OUT)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
