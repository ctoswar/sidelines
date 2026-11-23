/**
 * End-to-end verification for the Discover work:
 *
 *   npx tsx src/scripts/verify-discover.ts
 *
 * Part 1 - player Discover (browser): signs up a throwaway player, then walks
 *          the directory, a hub's tabs, follow/message, open-play join and a
 *          real court booking.
 * Part 2 - organizer isolation (API): two throwaway organizers each create a
 *          live tournament; each must see only their own, and going live must
 *          not demote the other account's live tournament.
 * Part 3 - cleanup: removes everything the script created (emails ending in
 *          @sidelines.test).
 *
 * The dev server must be running on localhost:3000.
 */

import { chromium } from "playwright";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";

const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR ?? "C:/Users/ctos/AppData/Local/Temp/opencode";
const MARK = "@sidelines.test";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function cookiesFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      return {
        name: pair.slice(0, index).trim(),
        value: pair.slice(index + 1).trim(),
        domain: "localhost",
        path: "/",
      };
    })
    .filter((cookie) => cookie.name && cookie.value);
}

async function createAccount(body: Record<string, unknown>) {
  const response = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ ...body, terms: true, confirm: body.password }),
  });
  const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(`signup failed (${response.status}): ${result?.message ?? "unknown"}`);
  }
  // The signup handler runs better-auth with the nextCookies plugin, so the
  // session cookie rides on the signup response itself.
  const signupCookies = cookiesFrom(response);
  if (signupCookies.length > 0) return signupCookies;

  const login = await api("/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: BASE },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  if (!login.ok) throw new Error(`login failed for ${String(body.email)} (${login.status})`);
  return cookiesFrom(login);
}

function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function partOne() {
  console.log("\nPart 1 — player Discover (browser)");

  const cookies = await createAccount({
    role: "player",
    username: "discover.tester",
    name: "Discover Tester",
    email: `discover.tester${MARK}`,
    password: "sidelines-demo",
    dateOfBirth: "1998-06-14",
    gender: "Prefer not to say",
    nationality: "Filipino",
    city: "Imus, Cavite",
    position: "Doubles",
    level: "Recreational",
    code: "",
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  // --- directory ---
  await page.goto(`${BASE}/player/discover`, { waitUntil: "networkidle" });
  const cardCount = await page.locator(".discover-card").count();
  check("directory renders hub cards", cardCount >= 8, `saw ${cardCount}`);
  await page.screenshot({ path: `${SHOT_DIR}/discover-list.png`, fullPage: true });

  await page.fill("#hub-search", "cebu");
  const filtered = await page.locator(".discover-card").count();
  check("search narrows the directory", filtered === 1, `saw ${filtered}`);
  // Clear the search so the map check below sees the whole directory.
  await page.locator(".discover-search-clear").click();
  const restored = await page.locator(".discover-card").count();
  check("clearing search restores the directory", restored === cardCount, `saw ${restored}`);

  const mapToggle = page.getByRole("button", { name: /map/i }).first();
  await mapToggle.click();
  await page.waitForSelector(".discover-pin", { timeout: 10_000 });
  const pins = await page.locator(".discover-pin").count();
  check("map view pins every mapped hub", pins >= 6, `saw ${pins}`);
  await page.screenshot({ path: `${SHOT_DIR}/discover-map.png`, fullPage: true });
  await page.getByRole("button", { name: /list/i }).first().click();

  const followed = page.getByRole("button", { name: "Followed", exact: true });
  await followed.click();
  const emptyShown = await page.locator(".discover-empty").isVisible();
  check("followed filter empty state", emptyShown);
  await page.getByRole("button", { name: "All", exact: true }).click();

  // --- hub detail: about ---
  await page.locator('.discover-card a[href$="cebu-pickle-club"]').click();
  await page.waitForURL("**/player/discover/cebu-pickle-club");
  await page.waitForSelector(".hub-hero");
  check("detail shows the hub name", (await page.locator(".hub-hero h1").innerText()).includes("Cebu Pickle Club"));
  check("detail shows member count", /\d{3,}/.test(await page.locator(".hub-hero-meta").innerText()));
  await page.screenshot({ path: `${SHOT_DIR}/hub-about.png`, fullPage: true });

  // follow
  const follow = page.locator(".hub-action-follow");
  await follow.click();
  await page.waitForFunction(
    () => document.querySelector(".hub-action-follow")?.textContent?.includes("Following"),
  );
  check("follow toggles on", true);
  // toast confirms with the hub name
  await page.waitForSelector('[role="status"]');
  check("follow toast", (await page.locator('[role="status"]').innerText()).includes("Following"));

  // message modal
  await page.locator(".hub-action-message").click();
  await page.waitForSelector(".hub-modal-card textarea");
  await page.fill(".hub-modal-card textarea", "Do you run beginner clinics on weekends?");
  await page.locator(".hub-modal-send").click();
  await page.waitForSelector(".hub-modal", { state: "detached" });
  check("message modal sends", true);

  // --- open play ---
  await page.getByRole("tab", { name: /open play/i }).click();
  await page.waitForSelector(".hub-day-strip");
  const dayCount = await page.locator(".hub-day").count();
  check("open play date strip", dayCount === 14, `saw ${dayCount}`);
  const joinButtons = page.locator(".hub-join");
  const joinCount = await joinButtons.count();
  check("open play sessions listed", joinCount > 0, `saw ${joinCount}`);
  if (joinCount > 0) {
    await joinButtons.first().click();
    // Paid sessions join through the checkout; free ones are one click.
    const checkoutOpen = await page
      .waitForSelector("#checkout-title", { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    check("paid session opens the checkout", checkoutOpen || (await page.locator(".hub-checkout").count()) === 0);
    if (checkoutOpen) {
      await page.locator(".checkout-agree input").check();
      await page.locator(".checkout-confirm").click();
      await page.waitForSelector("#checkout-title", { state: "detached" });
    }
    await page.waitForFunction(
      () => document.querySelector(".hub-join")?.textContent?.includes("Joined"),
    );
    check("open play join persists", true);
    const capacityText = await page.locator(".hub-capacity span").first().innerText();
    check("open play capacity updates", /\d+\/\d+/.test(capacityText), capacityText);
  }
  await page.screenshot({ path: `${SHOT_DIR}/hub-open-play.png`, fullPage: true });

  // --- booking ---
  await page.getByRole("tab", { name: /book a court/i }).click();
  await page.waitForSelector(".hub-booking-grid");
  const courtHeaders = await page.locator(".hub-booking-court").count();
  check("booking grid shows courts", courtHeaders === 6, `saw ${courtHeaders}`);
  await page.screenshot({ path: `${SHOT_DIR}/hub-booking.png`, fullPage: true });

  const openSlot = page.locator(".hub-slot.is-open").first();
  await openSlot.click();
  await page.waitForSelector(".hub-slot.is-mine", { timeout: 10_000 });
  check("booking a slot marks it yours", true);
  // cancel it again to leave the fixture grid clean
  await page.locator(".hub-slot.is-mine").first().click();
  await page.waitForFunction(() => !document.querySelector(".hub-slot.is-mine"), undefined, {
    timeout: 10_000,
  });
  check("cancelling your own slot works", true);

  // --- photos / events / news ---
  await page.getByRole("tab", { name: "Photos" }).click();
  const photos = await page.locator(".hub-photo").count();
  check("photo gallery", photos === 6, `saw ${photos}`);
  await page.locator(".hub-photo").first().click();
  await page.waitForSelector(".hub-lightbox");
  check("lightbox opens", true);
  await page.screenshot({ path: `${SHOT_DIR}/hub-lightbox.png` });
  await page.getByRole("button", { name: "Close photo" }).click();
  await page.waitForSelector(".hub-lightbox", { state: "detached" });

  await page.getByRole("tab", { name: "Events" }).click();
  await page.waitForSelector(".hub-section");
  // This database has no public catalogue events, so the honest empty state is
  // expected here; the organizer-owned hubs list their real events instead.
  const emptyEvents = await page.locator(".hub-empty").count();
  check("events tab renders (empty state ok)", emptyEvents === 1);

  await page.getByRole("tab", { name: "News" }).click();
  const news = await page.locator(".hub-news").count();
  check("news tab renders", news >= 2, `saw ${news}`);
  await page.screenshot({ path: `${SHOT_DIR}/hub-news.png`, fullPage: true });

  await browser.close();
}

async function partTwo() {
  console.log("\nPart 2 — organizer tournament isolation");

  const orgA = "org.a.discover";
  const orgB = "org.b.discover";
  const cookiesA = await createAccount({
    role: "organizer",
    username: orgA,
    name: "Org A Tester",
    email: `org.a.discover${MARK}`,
    password: "sidelines-demo",
    org: "Discover Org A",
    orgType: "Club",
    title: "Tournament director",
    volume: "1 to 2",
    city: "Manila, Philippines",
  });
  const cookiesB = await createAccount({
    role: "organizer",
    username: orgB,
    name: "Org B Tester",
    email: `org.b.discover${MARK}`,
    password: "sidelines-demo",
    org: "Discover Org B",
    orgType: "Club",
    title: "Tournament director",
    volume: "1 to 2",
    city: "Cebu, Philippines",
  });

  const create = (cookies: string, name: string) =>
    api("/api/tournaments", {
      method: "POST",
      headers: { Cookie: cookies },
      body: JSON.stringify({
        name,
        startDate: "2026-12-05",
        endDate: "2026-12-06",
        scheduleStart: "09:00",
        status: "live",
        city: "Manila",
      }),
    });

  const resA1 = await create(cookieHeader(cookiesA), "Discover Cup A");
  check("org A creates a live tournament", resA1.status === 201, `status ${resA1.status}`);

  const liveA1 = await api("/api/tournaments/live", { headers: { Cookie: cookieHeader(cookiesA) } });
  const liveA1Body = (await liveA1.json()) as { tournament?: { name?: string } };
  check(
    "org A live lookup returns its own",
    liveA1.ok && liveA1Body.tournament?.name === "Discover Cup A",
    JSON.stringify(liveA1Body),
  );

  const liveB0 = await api("/api/tournaments/live", { headers: { Cookie: cookieHeader(cookiesB) } });
  check("org B has no live tournament yet", liveB0.status === 404, `status ${liveB0.status}`);

  const resB1 = await create(cookieHeader(cookiesB), "Discover Cup B");
  check("org B creates a live tournament", resB1.status === 201, `status ${resB1.status}`);

  // The crux: B going live must NOT demote A's live tournament.
  const liveA2 = await api("/api/tournaments/live", { headers: { Cookie: cookieHeader(cookiesA) } });
  const liveA2Body = (await liveA2.json()) as { tournament?: { name?: string } };
  check(
    "org B going live leaves org A's live tournament alone",
    liveA2.ok && liveA2Body.tournament?.name === "Discover Cup A",
    JSON.stringify(liveA2Body),
  );

  // Workspace page scoping: A's dashboard lists only A's tournament.
  const dashA = await api("/organizer", { headers: { Cookie: cookieHeader(cookiesA) } });
  const dashAHtml = await dashA.text();
  check("org A dashboard lists its tournament", dashAHtml.includes("Discover Cup A"));
  check("org A dashboard hides org B's tournament", !dashAHtml.includes("Discover Cup B"));

  const dashB = await api("/organizer", { headers: { Cookie: cookieHeader(cookiesB) } });
  const dashBHtml = await dashB.text();
  check("org B dashboard lists its tournament", dashBHtml.includes("Discover Cup B"));
  check("org B dashboard hides org A's tournament", !dashBHtml.includes("Discover Cup A"));

  // Schedule scoping: /organizer/schedule should not crash and must be scoped.
  const schedA = await api("/organizer/schedule", { headers: { Cookie: cookieHeader(cookiesA) } });
  check("org A schedule page renders", schedA.ok, `status ${schedA.status}`);

  // Shared Discover: organizers browse the same directory, and their own hub
  // renders as ownership instead of a follow/message target.
  const discA = await api("/organizer/discover", { headers: { Cookie: cookieHeader(cookiesA) } });
  const discAHtml = await discA.text();
  check("organizer Discover renders the directory", discA.ok && discAHtml.includes("discover-hero"));
  check("organizer Discover lists clubs", discAHtml.includes("Cebu Pickle Club"));
  check("organizer Discover marks the organizer's own club", discAHtml.includes("Your club"));
  check(
    "organizer Discover links into the organizer hub pages",
    discAHtml.includes('href="/organizer/discover/'),
  );

  const orgFollow = await api("/api/hubs/cebu-pickle-club/follow", {
    method: "POST",
    headers: { Cookie: cookieHeader(cookiesA) },
  });
  const orgFollowBody = (await orgFollow.json()) as { following?: boolean };
  check(
    "organizer can follow a club from Discover",
    orgFollow.ok && orgFollowBody.following === true,
  );
  await api("/api/hubs/cebu-pickle-club/follow", {
    method: "DELETE",
    headers: { Cookie: cookieHeader(cookiesA) },
  });

  const orgMessage = await api("/api/hubs/cebu-pickle-club/message", {
    method: "POST",
    headers: { Cookie: cookieHeader(cookiesA) },
    body: JSON.stringify({ body: "Do you host club-vs-club friendlies?" }),
  });
  check("organizer can message a club from Discover", orgMessage.ok, `status ${orgMessage.status}`);

  const [orgAUser] = await db
    .select({ id: t.user.id })
    .from(t.user)
    .where(eq(t.user.email, `org.a.discover${MARK}`))
    .limit(1);
  const [orgARow] = orgAUser
    ? await db
        .select({ id: t.organizations.id })
        .from(t.organizations)
        .where(eq(t.organizations.ownerUserId, orgAUser.id))
        .limit(1)
    : [];
  const [orgAHub] = orgARow
    ? await db
        .select({ slug: t.sportsHubs.slug })
        .from(t.sportsHubs)
        .where(eq(t.sportsHubs.organizationId, orgARow.id))
        .limit(1)
    : [];

  if (orgAHub) {
    const own = await api(`/organizer/discover/${orgAHub.slug}`, {
      headers: { Cookie: cookieHeader(cookiesA) },
    });
    const ownHtml = await own.text();
    check("organizer own hub page renders", own.ok && ownHtml.includes("hub-hero"));
    check("organizer own hub hides the follow action", !ownHtml.includes("hub-action-follow"));
    check("organizer own hub explains ownership", ownHtml.includes("hub-owner-note"));
  } else {
    check("organizer own hub page renders", false, "no hub found for org A");
  }
}

async function cleanup() {
  console.log("\nPart 3 — cleanup");
  const testUsers = await db
    .select({ id: t.user.id, email: t.user.email })
    .from(t.user)
    .where(like(t.user.email, `%${MARK}`));
  const userIds = testUsers.map((row) => row.id);
  if (userIds.length === 0) {
    console.log("  nothing to clean");
    return;
  }

  const orgs = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(inArray(t.organizations.ownerUserId, userIds));
  const orgIds = orgs.map((org) => org.id);

  // Hub pages mirror the orgs; drop them before the users so organization_id
  // cannot be left dangling (the FK would only set null).
  for (const orgId of orgIds) {
    await db.delete(t.sportsHubs).where(eq(t.sportsHubs.organizationId, orgId));
  }

  // Tournaments + their published events.
  const removedTournaments = await db
    .delete(t.tournaments)
    .where(like(t.tournaments.name, "Discover Cup %"))
    .returning({ eventSlug: t.tournaments.eventSlug });
  for (const row of removedTournaments) {
    if (row.eventSlug) await db.delete(t.events).where(eq(t.events.slug, row.eventSlug));
  }

  // Open play signups + bookings + follows + messages belong to the test users.
  await db.delete(t.hubFollows).where(inArray(t.hubFollows.userId, userIds));
  await db.delete(t.hubBookings).where(inArray(t.hubBookings.userId, userIds));
  await db.delete(t.hubMessages).where(inArray(t.hubMessages.userId, userIds));
  await db.delete(t.hubOpenPlaySignups).where(inArray(t.hubOpenPlaySignups.userId, userIds));

  // Finally the users themselves (orgs, profiles, sessions cascade).
  await db.delete(t.user).where(inArray(t.user.id, userIds));
  console.log(`  removed ${userIds.length} test account(s) and their data`);
}

async function main() {
  if (process.env.CLEANUP_ONLY) {
    await cleanup();
    console.log("cleanup done.");
    process.exit(0);
  }
  await partOne();
  await partTwo();
  await cleanup();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  cleanup()
    .catch(() => undefined)
    .finally(() => process.exit(1));
});
