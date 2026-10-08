# Sidelines

Next.js (App Router) + TypeScript + Tailwind CSS starter with separate player and organizer areas.

## Run it
```bash
npm install
npm run dev   # http://localhost:3000
```

## Routes
- `/` public events feed (no login needed): search, filters, featured, upcoming/past, calendar view
- `/events/[slug]` public event page with tabs: Info, Teams, Schedule, Spirit, Pools, Bracket, Stats, MVP, Standings, Crew (deep-link with `#schedule`, `#bracket`...)
- `/about` marketing page, `/login`
- `/signup` role chooser, `/signup/player`, `/signup/organizer`
- **Organizer** `/organizer` (tournaments), `/organizer/tournaments/new`, `/organizer/teams`, `/organizer/schedule`, `/organizer/scorekeepers`, `/organizer/score`
- **Player** `/player` (home), `/player/schedule`, `/player/team`, `/player/tournaments`, `/player/profile`

## Demo login
Emails starting with `player` open the player dashboard. Any other email opens the organizer dashboard.

## Replace the mocks
- `src/lib/auth.ts`: swap in Supabase / Better Auth / Auth.js and store the role on the user.
- `src/lib/mock-data.ts`: replace with database queries.
- Add `middleware.ts` so `/organizer/*` requires role `organizer` and `/player/*` requires role `player`.

## Event data
`src/lib/event-detail.ts` generates sample teams, schedule, scores, stats and bracket from each event in `src/lib/events-data.ts`. Replace `getEventDetail()` with database queries; the UI only needs the `EventDetail` shape.
