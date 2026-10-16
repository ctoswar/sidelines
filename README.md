# Sidelines

Sidelines is a pickleball tournament operations app for organizers, players, scorekeepers, officials, and spectators. It covers scheduling, live point scoring, player profiles, event pages, standings, and QR-based court assignments.

Built with Next.js App Router, TypeScript, React, Tailwind CSS, Zod, React Hook Form, and QRCode, backed by PostgreSQL through Drizzle ORM with Better Auth for accounts and sessions.

## Run locally

Point `.env` at any PostgreSQL database (a Raspberry Pi, a container, or a hosted instance — the app does not need one on the dev machine):

```bash
cp .env.example .env   # fill in DATABASE_URL, BETTER_AUTH_SECRET, UPLOAD_DIR
npm install
npm run db:migrate
npm run db:seed        # production-safe: verifies the database is empty
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production checks

```bash
npm run lint
npm run build
npx tsc --noEmit
```

The build is database-free: every page that reads data renders per request (`force-dynamic`), so it succeeds with no reachable database.

Per-phase verification harnesses exercise each vertical against a running server (`npm run start`) with a database seeded by `npm run db:seed:demo` — SSR markers, mutation proofs (flip a row, watch the page follow, restore), and API contracts:

```bash
npx tsx src/scripts/verify-phase7.ts   # also verify-phase1 … verify-phase6
```

## Deploy with Docker

The `Dockerfile` is a multi-stage build that compiles Next.js standalone
output and runs it in a slim `node:22` runtime image. It is multi-arch, so
the same file builds on x86 machines and on the Raspberry Pi.

```bash
cp .env.example .env   # fill in DATABASE_URL, BETTER_AUTH_SECRET, UPLOAD_DIR
npm run db:migrate     # from a dev machine, against the target database
npm run db:seed        # production-safe: no fixtures are inserted
docker compose up -d app
```

Notes:

- The image never contains secrets: `.env` is gitignored, excluded via
  `.dockerignore`, and injected at runtime with `env_file`.
- Uploads (profile photos, team banners) are bind-mounted from `./var/uploads`
  so they survive redeploys. Back up that directory alongside the database.
- Migrations are not baked into the image — run them from a dev machine before
  deploying (`drizzle-kit` is a dev dependency).
- `docker-compose.yml` supports two arrangements: the app next to a
  **host-installed Postgres** (the current Pi setup — run only the `app`
  service), or the full stack on a fresh machine (run `app` + `db` and point
  `DATABASE_URL` at `db:5432`).

## Product areas

### Public

- `/` — pickleball event discovery with search, filters, featured events, upcoming/past events, and calendar view.
- `/events/[slug]` — public event page with Info, Teams, Schedule, Sportsmanship, Pools, Bracket, Stats, MVP, Standings, and Crew tabs.
- `/about` — product overview and live scoring demo.

### Authentication and signup

- `/login` — email/password sign-in (Better Auth).
- `/signup` — player or organizer account selection.
- `/signup/player` — guided three-step player setup:
  1. Identity and username
  2. Pickleball details and player profile
  3. Password and account creation
- `/signup/organizer` — organizer account and organization setup.

Player signup supports profile picture uploads using JPG, PNG, or WebP files up to 2 MB. Profile setup includes Singles/Doubles format, experience level, dominant hand, match category, bio, and profile accent color.

### Organizer workspace

- `/organizer` — tournament dashboard.
- `/organizer/tournaments/new` — create a tournament with pickleball match rules.
- `/organizer/events` — event hub list with registration counts; per-event hubs manage registrations and announcements.
- `/organizer/teams` — manage teams and player formats.
- `/organizer/schedule` — view court schedule, match status, and assigned crew popups.
- `/organizer/scorekeepers` — assign Scorekeeper and Umpire names, select a scheduled match, generate role-specific QR codes, and manage the QR queue.
- `/organizer/score` — organizer scoring view.

### Player workspace

- `/player` — player home and live match summary.
- `/player/schedule` — personal match schedule.
- `/player/team` — team profile and roster.
- `/player/tournaments` — available tournaments.
- `/player/registrations` — registered events with cancel flows.
- `/player/profile` — editable player identity, pickleball playbook, profile picture, and bio.

### QR scoring

QR codes open a role-specific scoring screen at `/score/[game]` without requiring a separate scorekeeper account. Each link carries only a capability token minted by the organizer; the person's name and role are resolved server-side from `game_crew`, so old or edited links simply get an invalid-link screen. The scoring model uses pickleball defaults:

- First to 11 points
- Win by 2
- Point-based scoring
- Per-side timeouts
- Offline indicator with a local event count (UI only — the final result is submitted to the server when the match finishes)

When a match reaches the winning score, its final result is persisted and the schedule updates to **Done**.

## Data and persistence

All application data lives in PostgreSQL, read and written through Drizzle:

- Accounts and sessions (Better Auth), player profiles, and organizations
- Event catalogue and each event's generated detail aggregate
- Tournaments, pool tables, the schedule of games, and final results
- Event registrations and live announcements
- QR crew assignments and their capability tokens
- Team profiles, the team roster, and open-tournament listings

Uploads (profile photos, team banners) are files on disk under `UPLOAD_DIR`, bind-mounted in Docker. Move them to object storage before running multiple app instances.

Realtime updates (results, crew saves, schedule changes, registrations, announcements) flow over an in-process SSE bus with an automatic polling fallback; see `src/server/realtime.ts`.

## Development fixtures

`npm run db:seed:demo` loads sample accounts, an organization, events, and a schedule so local development and the verification harnesses have data to work with. The fixtures use the password `sidelines-demo`:

- `player@example.com` — player workspace
- `organizer@example.com` — organizer workspace

For production, `npm run db:seed` is intentionally a no-op: organizers and players create real accounts and content through the UI. To remove previously seeded demo rows from a database, run `npm run db:clean:demo`.

Email/password is the working sign-in path. Google sign-in is not configured yet.

## Repository map

- `src/server/` — Drizzle schema, session helpers, and the read loaders (`events.ts`, `schedule.ts`, `team.ts`, `score.ts`)
- `src/app/api/` — route handlers for auth (Better Auth), events, registrations, announcements, scoring, team profiles, tournaments, and the realtime stream
- `src/server/realtime.ts` + `/api/stream` — the SSE bus; `src/lib/realtime.ts` is the client subscription with polling fallback
- `src/lib/mock-data.ts`, `src/lib/events-data.ts`, `src/lib/event-detail.ts` — seed sources and type homes; no page reads them at runtime
- `src/scripts/seed.ts` — production-safe seed (no fixtures inserted)
- `src/scripts/seed-demo.ts` — development fixtures
- `src/scripts/clean-demo-data.ts` — removes seeded demo rows from a database
- `src/scripts/verify-phase*.ts` — per-phase verification harnesses

## Event data

The event catalogue (`events`) and each event's generated aggregate (`event_details`) live in PostgreSQL, seeded from `src/lib/event-detail.ts`, which derives them from `src/lib/events-data.ts`. Pages and APIs read the database copy; the UI consumes the unchanged `EventDetail` shape, and `verify-phase4.ts` asserts the two representations stay identical.
