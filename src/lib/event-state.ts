// Date-derived event state.
//
// `events.status` and `events.live` are stored columns, but nothing keeps
// them in step with the calendar: a seed or a publish from months ago keeps
// answering "upcoming" / "live" long after the last day, so the homepage
// counts a finished event as "live now" and the event page still shows
// "Register for event". Rather than trusting the columns, the public reads
// derive the state from the dates.
//
// The comparison uses the event's own calendar date, inferred from its country
// code. A server in UTC would otherwise flip a Manila event a day late at
// 00:00–08:00 local, which is exactly when a same-day event is about to start.

import { dateInZone, zoneForCode } from "./timezones";

export type EventState = {
  /** "upcoming" until the last day is over, then "past". */
  status: "upcoming" | "past";
  /** The stored live flag, honoured only inside the event's date range. */
  live: boolean;
};

/** Date-only string for "now" in UTC (YYYY-MM-DD), or in `zone`. */
export function todayISO(now: Date = new Date(), zone?: string): string {
  return dateInZone(now, zone);
}

export function deriveEventState(
  startDate: string,
  endDate: string,
  storedLive: boolean,
  options: { code?: string; today?: string; now?: Date } = {},
): EventState {
  const today = options.today ?? todayISO(options.now ?? new Date(), zoneForCode(options.code));
  // An end date earlier than the start is treated as a one-day event.
  const lastDay = endDate >= startDate ? endDate : startDate;
  return {
    status: lastDay < today ? "past" : "upcoming",
    live: storedLive && startDate <= today && today <= lastDay,
  };
}
