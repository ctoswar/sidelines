// Pool-table client — the organizer workspace's team management.
//
// The pool belongs to the one live tournament, so these calls take no
// tournament id. "Team" here is a pool slot: for pickleball that is usually a
// single player's name, because players register solo. Adds are idempotent on
// the server (a name already in the pool is skipped), so the UI can offer a
// one-click "build from signups" without fear of duplicates.

import { jsonRequest, parse } from "./api-client";

export type TeamSource = "manual" | "csv" | "signups";

/** One pool slot as the table renders it. */
export type PoolTeam = {
  name: string;
  pool: "A" | "B";
  seed: number;
  source: TeamSource;
  /** The bridged signup, when this entrant came from an event registration. */
  userId?: string | null;
};

export type AddTeamsResult = {
  added: PoolTeam[];
  /** Names skipped because the pool already had them. */
  skipped: string[];
};

export type BridgeResult = AddTeamsResult & {
  /** Registrations considered; 0 with no additions means "no signups yet". */
  candidates: number;
  /** Human-readable note when there was nothing to do. */
  message?: string;
};

/**
 * Adds entrants to the live tournament's pool. `seed` may be omitted — the
 * server continues the numbering after the highest seed already taken. Pass
 * source "csv" when the entries came from a file so the table labels them.
 */
export async function addTeams(
  entries: { name: string; pool: "A" | "B"; seed?: number }[],
  source?: "manual" | "csv",
): Promise<AddTeamsResult> {
  return parse<AddTeamsResult>(
    await fetch("/api/tournaments/teams", jsonRequest({ teams: entries, source })),
  );
}

/**
 * Builds the pool from the live event's registrations: every registrant
 * becomes one seeded entrant under their own name, alternating pools A/B.
 * Idempotent — reruns only add newcomers.
 */
export async function buildPoolFromSignups(): Promise<BridgeResult> {
  return parse<BridgeResult>(await fetch("/api/tournaments/teams/signups", { method: "POST" }));
}

/** Removes one entrant from the pool by name. */
export async function removeTeam(name: string): Promise<void> {
  await parse<{ removed: boolean }>(
    await fetch(`/api/tournaments/teams/${encodeURIComponent(name)}`, { method: "DELETE" }),
  );
}

/**
 * Parses a CSV of entrants into add-team entries. Accepts an optional header
 * row and per-row seeds; without seeds the server numbers them. Columns are
 * name[,pool[,seed]] — so "Dana Cruz", "Dana Cruz,B", or "Dana Cruz,B,3".
 */
export function parseTeamCsv(text: string): { name: string; pool: "A" | "B"; seed?: number }[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // A header row names its first column; drop it so it is not imported.
  if (lines.length && /^name\b/i.test(lines[0].split(",")[0] ?? "")) lines.shift();

  return lines.flatMap((line) => {
    const [rawName, rawPool, rawSeed] = line.split(",").map((cell) => cell.trim());
    const name = rawName?.replace(/^"|"$/g, "").trim() ?? "";
    if (!name) return [];
    const pool: "A" | "B" = /^b$/i.test(rawPool ?? "") ? "B" : "A";
    const seed = Number(rawSeed);
    return [{ name, pool, ...(Number.isInteger(seed) && seed > 0 ? { seed } : {}) }];
  });
}
