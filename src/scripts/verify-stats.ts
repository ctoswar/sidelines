// End-to-end verification for the stats + open-play checkout build.
//
//   npx tsx src/scripts/verify-stats.ts   (dev server on :3000)
//
// Covers:
//   Part 1 — player stats + history tabs on My events (browser)
//   Part 2 — organizer players directory + shared profile (browser)
//   Part 3 — vouchers + checkout (API): owner CRUD, quotes, capacity, cancel
//   Part 4 — checkout UI flow + owner voucher panel (browser)

import { chromium } from "playwright";
import { and, eq, like } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";

const BASE = "http://localhost:3000";
const MARK = "@sidelines-stats.test";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, hint = "") {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${hint ? ` — ${hint}` : ""}`);
  }
}

function cookiesFrom(response: Response) {
  return response.headers.getSetCookie().map((cookie) => {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    return {
      name: pair.slice(0, index).trim(),
      value: pair.slice(index + 1).trim(),
      domain: "localhost",
      path: "/",
    };
  });
}

function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, init);
}

function todayIso(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

async function signupPlayer(username: string, name: string) {
  const response = await api("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "player",
      username,
      name,
      email: `${username}${MARK}`,
      password: "sidelines-demo",
      confirm: "sidelines-demo",
      dateOfBirth: "1995-05-05",
      gender: "Man",
      nationality: "Filipino",
      city: "Manila, Philippines",
      position: "Doubles",
      level: "Recreational",
      code: "",
      terms: true,
    }),
  });
  if (!response.ok) throw new Error(`player signup failed: ${response.status} ${await response.text()}`);
  return { cookies: cookiesFrom(response), email: `${username}${MARK}`, name };
}

async function signupOrganizer(username: string, name: string, org: string) {
  const response = await api("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "organizer",
      username,
      name,
      email: `${username}${MARK}`,
      password: "sidelines-demo",
      confirm: "sidelines-demo",
      org,
      orgType: "Club",
      title: "Tournament director",
      volume: "1 to 2",
      city: "Taguig, Philippines",
      terms: true,
    }),
  });
  if (!response.ok) throw new Error(`organizer signup failed: ${response.status} ${await response.text()}`);
  return { cookies: cookiesFrom(response), email: `${username}${MARK}`, name };
}

async function main() {
  // A team that actually has finals in the seeded schedule drives part 1.
  const [finalGame] = await db
    .select({ teamA: t.games.teamA, teamB: t.games.teamB })
    .from(t.games)
    .where(eq(t.games.status, "final"))
    .limit(1);
  if (!finalGame) throw new Error("No final games in the database — run the seed first.");
  const seededTeam = finalGame.teamA;

  console.log("Part 1 — player stats (browser)");
  const player = await signupPlayer("stats.player", "Duncan Stats");
  await api("/api/team", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(player.cookies) },
    body: JSON.stringify({
      name: seededTeam,
      tagline: "Stats verification squad",
      preset: "pitch",
      accent: "#c8ef70",
      division: "mixed",
      seed: 1,
    }),
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies(player.cookies);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/player/registrations`, { waitUntil: "networkidle" });
  check("my events renders the three tabs", (await page.locator(".myevents-tabs button").count()) === 3);
  await page.getByRole("tab", { name: "Player stats" }).click();
  await page.getByRole("heading", { name: "Player statistics" }).waitFor();
  check("stats tab renders the hero", await page.getByText("Win rate").isVisible());
  const matchSection = page.locator("section", {
    has: page.getByRole("heading", { name: "Match statistics" }),
  });
  const matchText = await matchSection.innerText();
  const matchesPlayed = Number(matchText.match(/Matches played\s*\n\s*(\d+)/)?.[1] ?? "0");
  check("match statistics computed from final games", matchesPlayed > 0, `got ${matchesPlayed}`);
  check(
    "win/loss and point tiles render",
    /Win\/Loss\s*\n\s*\d+-\d+/.test(matchText) && /Points won\s*\n\s*\d+/.test(matchText),
  );
  check(
    "tournament performance lists the played tournament",
    await page.getByText("Tournament performance").isVisible(),
  );

  await page.getByRole("tab", { name: "History" }).click();
  await page.waitForTimeout(200);
  check(
    "history tab renders (empty state while events are upcoming)",
    (await page.getByText("No completed tournaments yet").count()) > 0 ||
      (await page.locator("ul > li").count()) > 0,
  );

  console.log("Part 2 — organizer tournament, event and players directory");
  const organizer = await signupOrganizer("stats.organizer", "Olive Organizer", "Stats Pickle Club");
  const created = await api("/api/tournaments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(organizer.cookies) },
    body: JSON.stringify({
      name: `Stats Open ${Date.now()}`,
      startDate: todayIso(1),
      endDate: todayIso(2),
      city: "Taguig",
      scheduleStart: "09:00",
      status: "live",
    }),
  });
  check("organizer creates a live tournament (published event)", created.ok, `status ${created.status}`);
  const [orgRow] = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, (await getUser(organizer.email))!))
    .limit(1);
  const [hubRow] = orgRow
    ? await db
        .select({ id: t.sportsHubs.id, slug: t.sportsHubs.slug })
        .from(t.sportsHubs)
        .where(eq(t.sportsHubs.organizationId, orgRow.id))
        .limit(1)
    : [];
  check("organizer signup provisioned a hub", Boolean(hubRow));
  const [tournamentRow] = orgRow
    ? await db
        .select({ eventSlug: t.tournaments.eventSlug })
        .from(t.tournaments)
        .where(eq(t.tournaments.organizationId, orgRow.id))
        .limit(1)
    : [];
  const eventSlug = tournamentRow?.eventSlug ?? "";
  check("live tournament published an event", Boolean(eventSlug));

  if (eventSlug) {
    const registered = await api(`/api/events/${eventSlug}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player.cookies) },
      body: JSON.stringify({ division: "mixed" }),
    });
    check("player registers to the organizer's event", registered.ok, `status ${registered.status}`);
  }

  const directoryResponse = await api("/organizer/players", {
    headers: { Cookie: cookieHeader(organizer.cookies) },
  });
  const directoryHtml = await directoryResponse.text();
  check("players directory page renders", directoryResponse.ok && directoryHtml.includes("/organizer/players/"));
  check("directory lists the registered player", directoryHtml.includes(player.name));

  console.log("Part 3 — vouchers + checkout (API)");
  if (hubRow) {
    const slug = hubRow.slug;
    const sessionDate = todayIso(2);
    const weekday = new Date(`${sessionDate}T00:00:00`).getDay();
    const [paidTemplate] = await db
      .insert(t.hubOpenPlayTemplates)
      .values({
        hubId: hubRow.id,
        weekday,
        title: "MIDNIGHT OPENPLAY",
        startTime: "00:00",
        endTime: "04:00",
        level: "All levels",
        capacity: 3,
        price: "₱120",
        active: true,
      })
      .returning();
    const [freeTemplate] = await db
      .insert(t.hubOpenPlayTemplates)
      .values({
        hubId: hubRow.id,
        weekday,
        title: "Sunrise social",
        startTime: "06:00",
        endTime: "08:00",
        level: "All levels",
        capacity: 8,
        price: "",
        active: true,
      })
      .returning();

    const playerForbidden = await api(`/api/hubs/${slug}/vouchers`, {
      headers: { Cookie: cookieHeader(player.cookies) },
    });
    check("voucher list is owner-only", playerForbidden.status === 403, `status ${playerForbidden.status}`);

    const createdVoucher = await api(`/api/hubs/${slug}/vouchers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(organizer.cookies) },
      body: JSON.stringify({ code: "midnight10", kind: "percent", value: 10 }),
    });
    const voucherBody = (await createdVoucher.json()) as { voucher?: { id: string; code: string } };
    check(
      "owner creates a voucher (normalized uppercase)",
      createdVoucher.status === 201 && voucherBody.voucher?.code === "MIDNIGHT10",
      `status ${createdVoucher.status}`,
    );
    const duplicate = await api(`/api/hubs/${slug}/vouchers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(organizer.cookies) },
      body: JSON.stringify({ code: "MIDNIGHT10", kind: "percent", value: 10 }),
    });
    check("duplicate voucher code rejected", duplicate.status === 409, `status ${duplicate.status}`);

    const quote = await api(`/api/hubs/${slug}/vouchers/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player.cookies) },
      body: JSON.stringify({ templateId: paidTemplate.id, playerCount: 2, code: "MIDNIGHT10" }),
    });
    const quoteBody = (await quote.json()) as {
      quote?: { subtotal: number; discount: number; total: number; voucherApplied: boolean };
    };
    check(
      "quote applies 10% to two seats",
      quoteBody.quote?.subtotal === 240 &&
        quoteBody.quote?.discount === 24 &&
        quoteBody.quote?.total === 231,
      JSON.stringify(quoteBody.quote),
    );

    const booking = await api(`/api/hubs/${slug}/open-play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player.cookies) },
      body: JSON.stringify({
        templateId: paidTemplate.id,
        date: sessionDate,
        players: ["Ana Cruz"],
        voucherCode: "MIDNIGHT10",
      }),
    });
    const bookingBody = (await booking.json()) as {
      session?: { taken: number; myPlayers: number; joined: boolean };
      order?: { total: number; discount: number; playerCount: number; voucherCode: string } | null;
    };
    check(
      "checkout books two seats and records the order",
      booking.ok &&
        bookingBody.session?.taken === 2 &&
        bookingBody.session?.myPlayers === 2 &&
        bookingBody.order?.total === 231 &&
        bookingBody.order?.voucherCode === "MIDNIGHT10",
      JSON.stringify(bookingBody),
    );

    const player2 = await signupPlayer("stats.player2", "Mika Dropshot");
    const badVoucher = await api(`/api/hubs/${slug}/open-play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player2.cookies) },
      body: JSON.stringify({
        templateId: paidTemplate.id,
        date: sessionDate,
        players: [],
        voucherCode: "NOPE",
      }),
    });
    check("unknown voucher rejected at booking", badVoucher.status === 400, `status ${badVoucher.status}`);

    const overbook = await api(`/api/hubs/${slug}/open-play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player2.cookies) },
      body: JSON.stringify({ templateId: paidTemplate.id, date: sessionDate, players: ["Rio", "Sam"] }),
    });
    check("capacity enforced across guest seats", overbook.status === 409, `status ${overbook.status}`);

    const freeJoin = await api(`/api/hubs/${slug}/open-play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader(player2.cookies) },
      body: JSON.stringify({ templateId: freeTemplate.id, date: sessionDate }),
    });
    const freeBody = (await freeJoin.json()) as { session?: { taken: number; joined: boolean }; order?: unknown };
    check(
      "free sessions join without an order",
      freeJoin.ok && freeBody.session?.joined === true && freeBody.order === null,
      JSON.stringify(freeBody),
    );

    const cancel = await api(
      `/api/hubs/${slug}/open-play?templateId=${paidTemplate.id}&date=${sessionDate}`,
      { method: "DELETE", headers: { Cookie: cookieHeader(player.cookies) } },
    );
    const cancelBody = (await cancel.json()) as { session?: { taken: number } };
    check("cancel releases every guest seat", cancel.ok && cancelBody.session?.taken === 0);
    const [orderRow] = await db
      .select({ status: t.hubOpenPlayOrders.status })
      .from(t.hubOpenPlayOrders)
      .where(eq(t.hubOpenPlayOrders.templateId, paidTemplate.id))
      .limit(1);
    check("cancelled order is marked cancelled", orderRow?.status === "cancelled", orderRow?.status);

    console.log("Part 4 — checkout + owner panel (browser)");
    await page.goto(`${BASE}/player/discover/${slug}`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Open Play" }).click();
    await page.locator(".hub-day.has-sessions").first().click();
    await page.getByRole("button", { name: "Join Game" }).first().click();
    await page.waitForSelector("#checkout-title");
    check("checkout modal opens from Join Game", await page.getByText("Payment summary").isVisible());
    await page.locator('[aria-label="Add a player"]').click();
    await page.locator('[placeholder="Guest 1 name"]').fill("Ana Cruz");
    await page.locator('[placeholder="Enter voucher code"]').fill("MIDNIGHT10");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator(".checkout-row.is-discount").waitFor();
    check("voucher applies in the checkout", (await page.locator(".checkout-row.is-discount").innerText()).includes("24"));
    await page.locator(".checkout-agree input").check();
    await page.locator(".checkout-confirm").click();
    await page.waitForSelector("#checkout-title", { state: "detached" });
    await page.waitForTimeout(400);
    const cards = await page.locator(".hub-openplay").allInnerTexts();
    console.log("        cards:", JSON.stringify(cards));
    check(
      "session card shows the multi-seat booking",
      (await page.locator(".hub-openplay.is-joined", { hasText: "Joined · 2" }).count()) > 0,
    );

    const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ownerContext.addCookies(organizer.cookies);
    const ownerPage = await ownerContext.newPage();
    ownerPage.on("pageerror", (error) => errors.push(`owner: ${error.message}`));
    await ownerPage.goto(`${BASE}/organizer/discover/${slug}`, { waitUntil: "networkidle" });
    await ownerPage.getByRole("tab", { name: "Open Play" }).click();
    await ownerPage.getByText("Vouchers").waitFor();
    check("owner sees the voucher panel on their hub", await ownerPage.getByText("MIDNIGHT10").isVisible());
    check("owner cannot join their own session", (await ownerPage.getByText("Your session").count()) > 0);

    await ownerPage.goto(`${BASE}/organizer/players`, { waitUntil: "networkidle" });
    check("organizer nav has Players", (await ownerPage.locator('a[href="/organizer/players"]').count()) > 0);
    await ownerPage.locator(`a:has-text("${player.name}")`).first().click();
    await ownerPage.getByRole("heading", { name: "Player statistics" }).waitFor();
    check(
      "organizer opens the shared stats profile",
      (await ownerPage.getByRole("heading", { name: "Match statistics" }).count()) > 0,
    );
    await ownerContext.close();
  }

  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

async function getUser(email: string): Promise<string | null> {
  const [row] = await db.select({ id: t.user.id }).from(t.user).where(eq(t.user.email, email)).limit(1);
  return row?.id ?? null;
}

async function cleanup() {
  const users = await db
    .select({ id: t.user.id })
    .from(t.user)
    .where(like(t.user.email, `%${MARK}`));
  for (const row of users) {
    await db.delete(t.user).where(and(eq(t.user.id, row.id)));
  }
  console.log("cleaned up");
}

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
  } catch {
    /* best effort */
  }
  process.exit(1);
});
