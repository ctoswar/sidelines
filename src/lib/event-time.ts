export type TimeMode = "event" | "mine";

export const t12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));

// Event times are stored in the event's local time. "mine" converts them to the viewer's time zone.
export function shown(date: string, time: string, offset: number, mode: TimeMode) {
  if (mode === "event") return t12(time);
  const [h, m] = time.split(":").map(Number);
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h - offset, m));
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}
