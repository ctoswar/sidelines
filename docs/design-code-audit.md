# Design ↔ code audit

Baseline audit of the Figma file **Sidelines – UI Capture**
(`z3ykDTsxCyEjm7hgtQE9Ha`, Page 1) against this codebase.

Follows the proposal-first review gate: the audit is read-only, every proposed
change is listed for approval, and only approved items are applied. Foundational
to the two existing workspace audits (`organizer-workspace-audit.md`,
`player-workspace-audit.md`).

## Screen → route map

Every Figma screen has a code counterpart except one duplicate frame.

| Figma screen | node | Code route | Status |
| --- | --- | --- | --- |
| Sidelines – Pickleball events, live scores and results | `6:2` | `/` (`src/app/page.tsx`) | matches |
| Sidelines – Pickleball tournament scoring (marketing) | `2:2` | `/about` | matches |
| Gentry Pickle Ball – Sidelines | `9:2` | `/events/[slug]` | matches |
| DestinyPickleBall – Sidelines | `10:2` | `/events/[slug]` | matches |
| Log in – Sidelines | `8:4` | `/(auth)/login` | matches |
| Sign up – Sidelines (role choice) | `7:2` | `/(auth)/signup` | matches |
| Player sign up – Sidelines | `11:2` | `/(auth)/signup/player` | matches |
| Organizer sign up – Sidelines | `12:4` | `/(auth)/signup/organizer` | matches |
| Home – Sidelines | `35:2` | `/player` | matches |
| My schedule – Sidelines | `36:2` | `/player/schedule` | matches |
| Find tournaments – Sidelines | `37:2` | `/player/tournaments` | matches |
| My events – Sidelines | `38:2` | `/player/registrations` | matches |
| My team – Sidelines | `40:2` | `/player/team` | matches |
| Profile – Sidelines | `39:2` | `/player/profile` | matches |
| Tournaments – Sidelines | `16:2` | `/organizer` | matches |
| Sidelines / Teams | `18:2` | `/organizer/teams` | matches |
| Sidelines / Schedule | `19:2` | `/organizer/schedule` | matches |
| Sidelines / Scorekeepers | `21:2` | `/organizer/scorekeepers` | matches |
| DestinyPickleBall hub – Sidelines | `23:2` | `/organizer/events/[slug]` | matches |
| Tournaments – Sidelines (duplicate) | `26:2` | — | **no route**: byte-identical copy of `16:2` |

### Code routes with no Figma screen

Covered by wireframes rather than polished screens — all five live in the Figma
section **Wireframes – missing routes** (`80:2`), grey-only, built from the
routes' real headings, labels and layout so they read as low-fi beside the
finished screens. They carry **no prototype reactions**, so presenting the flow
never drops you into a wireframe.

| Route | Wireframe | Notes |
| --- | --- | --- |
| `/organizer/events` — the hub *list* behind `← All events` | `80:3` | rows + `Open hub` |
| `/organizer/score` — sidebar `06 Score a game` | `80:38` | score panel inside the workspace shell |
| `/organizer/tournaments/new` | `80:85` | 3-step wizard, shows step 1 |
| `/score/[game]` — valid grant | `80:124` | mobile, no sidebar, crew chips |
| `/score/[game]` — invalid token | `83:2` | "This scoring link is not valid" |

## Audit result

**No code changes proposed.** Copy, section order, button labels, form fields,
sidebar numbering and tab lists matched the design across all four batches.

| Batch | Screens | Result |
| --- | --- | --- |
| 1 — Public | `2:2`, `6:2`, `9:2`, `10:2` | no change |
| 2 — Auth | `8:4`, `7:2`, `11:2`, `12:4` | no change |
| 3 — Player | `35:2`, `36:2`, `37:2`, `38:2`, `40:2`, `39:2` | no change |
| 4 — Organizer | `16:2`, `18:2`, `19:2`, `21:2`, `23:2`, `26:2` | no change |

### Candidate diffs investigated and cleared

Each of these looked like a mismatch from the text inventory alone; reading the
source cleared it. Kept for traceability so they are not re-raised.

| Candidate | Design | Code | Verdict |
| --- | --- | --- | --- |
| Tournament row actions | `Save as draft` / `Make live` | `tournament-actions.tsx:33` renders exactly those labels | clear |
| Schedule division pills | `All divisions · Men's · Women's · Mixed` | `schedule-view.tsx:117` maps `lib/divisions.ts` labels (`Men's`, `Women's`, `Mixed`) | clear |
| Event hub back link | `← All events` | `event-hub.tsx:96` | clear |
| Home announcement fallback | `Your 10:30 match moved from Court 3 to Court 1…` | `announcements-feed.tsx:34` | clear |

> Note: `docs/player-workspace-audit.md` still describes the fallback as
> "Field 3 → Field 1"; it has since been changed to Court 1 to match the design.

## Design-side changes applied

These were Figma-only; no code was involved.

| # | Change | Reason |
| --- | --- | --- |
| 4 | Flow start `Sidelines – Public site` moved `2:2` → `6:2` | The prototype opened on the marketing page, but the app's `/` is the events listing |
| 5 | Logo wire `6:6 → 2:2` removed | `SiteHeader` sends the logo to `/`, so the wire pointed somewhere the app never goes |

Also in scope of this session: the five page-level groups were converted to
Figma **Sections** (identical bounds, transparent fills, positions verified to
the pixel) because Figma rejects prototype links to or from frames inside a
plain group. The prototype now carries **94 reactions** (95, minus the logo wire
removed as item 5) and 3 flow starting points (public site, player workspace,
organizer workspace), with zero broken destinations.

Follow-up design-side work, all approved in session:

| Change | Result |
| --- | --- |
| Canvas reorganised into four bands — Public, Auth, Player, Organizer — screens in nav order, uniform gaps | 0 overlapping blocks; canvas 9,896 × 10,781 (was ~22,000 × 8,000) |
| Empty duplicate frame `12:2` deleted (a wire had already been retargeted to `12:4`) | one fewer ghost screen behind Organizer sign-up |
| Section `Organazer` renamed `Organizer` | typo fixed |
| Section **Wireframes – missing routes** (`80:2`) added below Organizer | five low-fi wireframes, table above |

## Method and limits

- Structural + copy comparison of each Figma frame against the corresponding
  route, components and Tailwind classes.
- **Not verified:** rendered pixels — colour, spacing and typography are
  asserted from CSS only, never from a rendered page.
- Two blockers hit mid-session: the Figma MCP Starter plan's tool-call rate
  limit stopped the render fetches part-way through the audit (they recovered
  later, after batch 4 had already been compared from text inventories alone),
  and no screenshots of the running app were taken. Playwright + Chromium are
  now installed as a dev dependency, but the screenshot script does not exist
  yet — so pixel comparison is still outstanding.

## Recommended next steps

1. Playwright is installed (`playwright@1.64.1` + Chromium); what's missing is
   the small screenshot script so future audits can diff real renders against
   Figma exports. Needs a dev server and a seeded DB — and an organizer session
   for the `/organizer/*` routes.
2. Re-run the pixel-level pass once that script exists.
3. Decide the fate of duplicate frame `26:2` — delete it, or give it a route.
