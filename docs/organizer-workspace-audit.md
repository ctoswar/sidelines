# Organizer workspace audit

## Current connection map

| Area | Current state | Risk |
| --- | --- | --- |
| Tournaments | List and creation wizard use mock data; the configured first-game time now persists in this browser and shifts the seeded schedule. | Tournament name, dates, rules, fields, and divisions are not persisted yet. |
| Teams | Displays seeded teams from `mock-data.ts`. | Add team and CSV import are still placeholders; the seeded schedule includes teams not in the team table. |
| Schedule | Uses the seeded schedule and the saved first-game time; filters and game links work. | Auto-fill is still a toast-only demo; edits, moves, cancellations, and persistence are missing. |
| Scorekeepers | Assignment, role labels, QR links, and schedule start time are connected during the current session. | Assignments are page-local and reset on refresh; real multi-device sharing needs an API. |
| Scoring | Loads the selected game and schedule label; timer and role/crew context are shown. | Scores remain reducer-local and do not update schedule status, standings, or public event results. Rules are still hard-coded in `ScorePanel`. |
| Event hub | Registrations and announcements have browser-local CRUD. | Public event pages use generated event data, so organizer announcements and score updates do not become shared live data. |

## Recommended next product slice

1. Introduce one active tournament record with a stable ID and rules/configuration.
2. Add a real persistence boundary (database/API); use local storage only for a clearly labelled demo mode.
3. Finish tournament CRUD: draft, edit, duplicate, archive/delete with confirmation and validation.
4. Finish team CRUD: add/edit/delete, unique names, division/pool/seed validation, then generate schedules from those teams.
5. Persist games, scorekeeper assignments, and score events. Make finish/reopen update schedule status and standings.
6. Add organizer role protection and QR authorization before using this for live events.

## Deliberately deferred

CSV import, email invitations, full bracket/reseeding tools, offline conflict resolution, and multi-device live sync should follow the shared data model rather than be added as more page-local state.
