# Figma: player signup wizard — design record

File: `z3ykDTsxCyEjm7hgtQE9Ha`, page `0:1`, section `71:3` (Signup).

The player registration flow in code is a **3-step wizard** (`src/features/auth/player-signup-form.tsx`):
`Identity → Player details → Ready`. The Figma file only had step 1, so steps 2 and 3 were
built by duplicating the existing step-1 frame and swapping the step panel, keeping the exact
shell (aside, tabs, profile preview, progress bar).

## Frames

| Step | Frame | Node ID | Height |
|---|---|---|---|
| 01 Identity | Player sign up – Sidelines | `11:2` | 1130 |
| 02 Player details | Player sign up – step 2 – Player details | `114:2` | 1335 |
| 03 Ready | Player sign up – step 3 – Ready | `114:142` | 980 |

## Step 02 — Player details (`114:2`)

Fields match the real form and validator enums (`src/lib/validators/auth.ts`):

- Date of birth (date trigger, `Select your birth date` + ▣), Gender
- Nationality (`Filipino`), City (`Imus, Cavite`)
- Preferred format (Singles/Doubles/Both), Experience level (First season/Recreational/Tournament player)
- Dominant hand (optional) (Right/Left/Both), Playing since (optional) (years)
- Gender match (Prefer not to say/Open/Women's/Mixed: MMP/Mixed: WMP), Jersey number (optional)
- Short bio (optional) — wide textarea
- Actions: `← Back` (secondary) + `Continue to login →` (primary)

Progress bar: steps 01 + 02 active (acid circle, ink label), per `index <= step` in code.

## Step 03 — Ready (`114:142`)

- Password + Confirm password (both with `Show`), Team join code (optional, `IRON-4821`)
- Actions: `← Back` + `Enter the sidelines ↗` (primary, submit)
- Terms checkbox row: "I agree to the Terms of service and Privacy policy."
- Panel uses the `signup-security-section` warm tint (`rgba(232,225,212,.34)`), as in code
- Progress bar: all three steps active

## Prototype wiring

The real form only allows navigating **back** to completed steps (`disabled={index > step}`),
so the prototype mirrors that:

| From | Control | To |
|---|---|---|
| `11:2` | Continue to player details → | `114:2` |
| `114:2` | ← Back | `11:2` |
| `114:2` | Continue to login → | `114:142` |
| `114:2` | progress 01 | `11:2` |
| `114:142` | ← Back | `114:2` |
| `114:142` | Enter the sidelines ↗ | `35:2` (player home — post-signup destination, `homeFor("player")`) |
| `114:142` | progress 01 / 02 | `11:2` / `114:2` |

## Status / known gaps

- ✅ Both frames built and placed in the Signup section (section widened to 11720 px).
- ⏳ Wiring pending: the Figma MCP Starter-plan monthly tool-call quota was exhausted
  (20 calls/month on a View seat). Run the wiring script once the quota resets (Nov 1)
  or the seat is upgraded. The script only wires nodes with **zero existing reactions**
  and verifies every destination resolves — see the design-code audit for the pattern.
- The step-1 preview copy in Figma predates the current code copy ("Your sideline identity"
  kicker / `@username` handle) — left as-is to avoid clobbering; update together with any
  future step-1 refresh.
