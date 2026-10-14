# Sidelines

Sidelines is a pickleball tournament operations app for organizers, players, scorekeepers, officials, and spectators. It covers scheduling, live point scoring, player profiles, event pages, standings, and QR-based court assignments.

Built with Next.js App Router, TypeScript, React, Tailwind CSS, Zod, React Hook Form, and QRCode.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production checks

```bash
npm run build
npx tsc --noEmit
```

## Product areas

### Public

- `/` — pickleball event discovery with search, filters, featured events, upcoming/past events, and calendar view.
- `/events/[slug]` — public event page with Info, Teams, Schedule, Sportsmanship, Pools, Bracket, Stats, MVP, Standings, and Crew tabs.
- `/about` — product overview and live scoring demo.

### Authentication and signup

- `/login` — demo login.
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
- `/organizer/teams` — manage teams and player formats.
- `/organizer/schedule` — view court schedule, match status, and assigned crew popups.
- `/organizer/scorekeepers` — assign Scorekeeper and Umpire names, select a scheduled match, generate role-specific QR codes, and manage the QR queue.
- `/organizer/score` — organizer scoring view.

### Player workspace

- `/player` — player home and live match summary.
- `/player/schedule` — personal match schedule.
- `/player/team` — team profile and roster.
- `/player/tournaments` — available tournaments.
- `/player/profile` — editable player identity, pickleball playbook, profile picture, and bio.

### QR scoring

QR codes open a role-specific scoring screen at `/score/[game]` without requiring a separate scorekeeper account. The scoring model uses pickleball defaults:

- First to 11 points
- Win by 2
- Point-based scoring
- Per-side timeouts
- Offline event queue in the demo scorer

When a match reaches the winning score, its final result is persisted and the schedule updates to **Done**.

## Demo data and persistence

This repository currently uses browser-local demo storage rather than a backend database. The following are persisted in `localStorage`:

- Demo accounts and session
- Player profile and profile picture
- Player/team settings
- Scorekeeper crew assignments
- Completed match results
- Event registrations and announcements

Replace these demo stores before production use. Profile images are stored as browser data URLs for the demo and should be moved to managed object storage in production.

## Demo login

For the original demo shortcut, emails beginning with `player` open the player workspace. Other email addresses open the organizer workspace. Newly created accounts are stored locally and sign in immediately.

## Replace the mocks

- `src/lib/auth.ts` — replace demo authentication with Supabase, Better Auth, Auth.js, or another server-backed provider.
- `src/lib/mock-data.ts` — replace seeded teams, matches, tournaments, and crew with database queries.
- `src/lib/player-profile.ts` — replace browser profile storage with an authenticated profile API.
- `src/lib/game-results.ts` — replace browser result storage with server-backed match results.
- `src/lib/game-crew.ts` — replace browser crew storage with organizer-authorized assignments.
- Add `middleware.ts` so `/organizer/*` requires the organizer role and `/player/*` requires the player role.

## Event data

`src/lib/event-detail.ts` generates sample pickleball teams, court schedules, scores, player stats, pools, brackets, and standings from `src/lib/events-data.ts`. Replace `getEventDetail()` with database queries; the UI consumes the existing `EventDetail` shape.
