// Tournament display summary.
//
// The tournaments table stores no date, court, or division columns — the row's
// human summary lives in `meta` ("Oct 24–25 · 8 teams · Open division" was the
// seeded shape). This module turns what the new-tournament wizard collects
// into that same shape, so a tournament created through the UI reads like a
// seeded one did.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type TournamentBasics = {
  startDate: string;
  endDate?: string;
  courts?: number;
  divisions?: string[];
};

type Day = { year: number; month: number; day: number };

/** "2026-11-07" -> the day it names; null when the value is not a date. */
function parseDay(value?: string): Day | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function label(day: Day) {
  return `${MONTHS[day.month - 1]} ${day.day}`;
}

function isBefore(a: Day, b: Day) {
  return a.year < b.year || (a.year === b.year && (a.month < b.month || (a.month === b.month && a.day < b.day)));
}

/**
 * "Nov 7, 2026" (one day), "Nov 7–8, 2026" (one month), "Nov 30 – Dec 2,
 * 2026" (across a month), "Dec 30, 2026 – Jan 2, 2027" (across a year).
 * Returns "" when there is no usable start date.
 */
export function describeRange(startDate?: string, endDate?: string): string {
  const from = parseDay(startDate);
  if (!from) return "";

  const parsedEnd = parseDay(endDate);
  // A reversed range reads the same as the range it names, not as an error.
  const to = parsedEnd && isBefore(parsedEnd, from) ? from : (parsedEnd ?? from);

  if (to.year === from.year && to.month === from.month && to.day === from.day) {
    return `${label(from)}, ${from.year}`;
  }
  if (to.year === from.year && to.month === from.month) {
    return `${MONTHS[from.month - 1]} ${from.day}–${to.day}, ${from.year}`;
  }
  if (to.year === from.year) {
    return `${label(from)} – ${label(to)}, ${from.year}`;
  }
  return `${label(from)}, ${from.year} – ${label(to)}, ${to.year}`;
}

/** The `meta` string for a tournament created through the wizard. */
export function describeTournament(basics: TournamentBasics): string {
  const parts: string[] = [describeRange(basics.startDate, basics.endDate)];

  if (basics.courts) parts.push(`${basics.courts} court${basics.courts === 1 ? "" : "s"}`);

  const divisions = basics.divisions ?? [];
  if (divisions.length) {
    parts.push(`${divisions.join(", ")} division${divisions.length === 1 ? "" : "s"}`);
  }

  return parts.filter(Boolean).join(" · ");
}
