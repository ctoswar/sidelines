// Event timezones.
//
// Events store a country code, never an IANA zone, so the best zone the app
// can infer is the country's main one. Offsets are computed for the event's
// own dates instead of being hard-coded: Australia and New Zealand observe
// daylight saving, and a fixed "GMT+11" is wrong for half the year.

/** Country code -> the zone the catalogue treats as that country's local time. */
export const COUNTRY_ZONES: Record<string, string> = {
  PH: "Asia/Manila",
  JP: "Asia/Tokyo",
  SG: "Asia/Singapore",
  HK: "Asia/Hong_Kong",
  AU: "Australia/Sydney",
  KR: "Asia/Seoul",
  TH: "Asia/Bangkok",
  TW: "Asia/Taipei",
  MY: "Asia/Kuala_Lumpur",
  NZ: "Pacific/Auckland",
};

export function zoneForCode(code: string | null | undefined): string | undefined {
  return code ? COUNTRY_ZONES[code.toUpperCase()] : undefined;
}

/**
 * The zone's UTC offset in hours at noon UTC on `date` (YYYY-MM-DD). Noon
 * avoids the hour that a spring-forward day skips. Returns 0 for an unknown
 * zone or an unparseable date, matching the old GMT+0 fallback.
 */
export function gmtOffsetHours(zone: string | undefined, date: string): number {
  if (!zone) return 0;
  const at = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return 0;
  try {
    // `shortOffset` prints exactly the offset the zone is observing ("GMT+11",
    // "GMT+5:30"), which avoids guessing whether a clock-time difference
    // crossed a date boundary — noon UTC is already midnight in Auckland.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) + Number(match[3] ?? 0) / 60);
  } catch {
    return 0;
  }
}

/** The calendar date (YYYY-MM-DD) at `now` in `zone`; UTC when absent. */
export function dateInZone(now: Date, zone: string | undefined): string {
  if (!zone) return now.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: "year" | "month" | "day") =>
      parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** "GMT+8" / "GMT+5.5" / "GMT-4" — the label every surface prints. */
export function formatGmtOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const value = Math.abs(offset);
  return `GMT${sign}${Number.isInteger(value) ? value : value.toFixed(1)}`;
}
