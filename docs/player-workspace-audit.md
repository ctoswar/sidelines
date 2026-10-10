# Player workspace audit

Follow-up to `organizer-workspace-audit.md`. Findings and fixes tracked in
[issue #21](https://github.com/ctoswar/sidelines/issues/21).

## Current connection map

| Area | Current state | Risk |
| --- | --- | --- |
| Workspace shell | Guarded by `WorkspaceGuard`: no session goes to `/login?next=…`, a mismatched role goes to that role's home. The sidebar identity and the Log out button are driven by the real session. | The guard runs client-side after paint, so a signed-out visitor sees one frame of the workspace before the redirect. It is a demo session in localStorage, not an authorization boundary. |
| My events | Reads `myRegistrations()`, groups upcoming and past, shows status chips, a start countdown and a summary count. Cancelling is a two-step confirm with a toast. | Registrations are keyed by session email in localStorage, so they are per-browser and per-account only. There is no roster, payment or organizer confirmation behind them. |
| Home | Shows the next live game, the next game, a pool standing and the shared announcements feed. | Everything is static mock data — none of it reflects the signed-in player's registrations, schedule or actual results. The announcements feed also falls back to a hard-coded "Your 10:30 game moved from Field 3 to Field 1" whenever no organizer announcement exists. |
| My schedule | Filters the seeded `games` list down to `MY_TEAM`. | Not connected to registrations, the event catalogue or any real fixture list. |
| My team | Shows the seeded roster and a copyable join code. | The join code is a constant (`IRON-4821`); joining a team does nothing, and the roster is not editable. |
| Find tournaments | Lists `openTournaments` and deep-links to `/events/<slug>` to register. | Every current entry has a slug, so the slug-less "Register" fallback (a toast) is unreachable until a slug-less tournament is added. |
| Profile | Form fields with fixed defaults and a "Profile saved (mockup)" toast. | Nothing is read from or written to the session — the signed-in user's name never appears here. |

## Recommended next product slice

1. Persist profiles against the session so Profile and the sidebar read the same record.
2. Derive Home and My schedule from the player's registrations instead of the seeded `games` list.
3. Give registrations a real lifecycle: team roster, division, captain approval, and withdrawal that the organizer can see.
4. Replace the localStorage demo store with an API shared by both workspaces; keep local storage only as a clearly labelled demo mode.
5. Apply the same `WorkspaceGuard` and page-title treatment to the organizer workspace.

## Deliberately deferred

The organizer guard and page titles, session-driven Home/schedule, editable team rosters, waitlists, and cross-device sync should follow the shared data model rather than be added as more page-local state.
