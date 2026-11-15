// Date-derived event state.
//
// `events.status` and `events.live` are stored columns, but nothing keeps
// them in step with the calendar: a seed or a publish from months ago keeps
// answering "upcoming" / "live" long after the last day, so the homepage
// counts a finished event as "live now" and the event page still shows
// "Register for event". Rather than trusting the columns, the public reads
// derive the state from the dates.
//
// TODO: the comparison uses the server's current date in UTC. Events around
// midnight in their own time zone can flip a day early/late — swap in the
// event's IANA time zone once it lives on the row.

export type EventState = {
  /** "upcoming" until the last day is over, then "past". */
  status: "upcoming" | "past";
  /** The stored live flag, honoured only inside the event's date range. */
  live: boolean;
};

/** Date-only string for "now" in UTC (YYYY-MM-DD). */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function deriveEventState(
  startDate: string,
  endDate: string,
  storedLive: boolean,
  today: string = todayISO(),
): EventState {
  // An end date earlier than the start is treated as a one-day event.
  const lastDay = endDate >= startDate ? endDate : startDate;
  return {
    status: lastDay < today ? "past" : "upcoming",
    live: storedLive && startDate <= today && today <= lastDay,
  };
}
