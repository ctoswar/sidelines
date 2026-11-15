// Entrant count chip on event rows.
//
// Used to draw five invented avatar initials plus "N teams joined" — but
// pickleball registrations here are per player, so a two-person event showed
// two fake people as "2 teams". The count is real (registrations/pool rows);
// the presentation is now a plain, honest chip.
export function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center">
      <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        {count} {count === 1 ? "entrant" : "entrants"}
      </span>
    </div>
  );
}
