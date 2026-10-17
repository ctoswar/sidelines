import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TeamName } from "@/components/dashboard/team-name";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { loadGames } from "@/server/schedule";
import { requireRole } from "@/server/session";
import { loadTeamRow } from "@/server/team";

export const metadata = { title: "Home – Sidelines" };
export const dynamic = "force-dynamic";

export default async function PlayerHome() {
  const user = await requireRole("player");
  // Games are matched on this player's own team name — there is no seeded
  // team constant to match against, so an unscheduled player sees an empty
  // state instead of someone else's fixture.
  const team = await loadTeamRow(user.id);
  const games = await loadGames();
  const mine = games.filter((g) => g.teamA === team?.name || g.teamB === team?.name);
  const live = mine.find((g) => g.status === "live");
  const next = mine.find((g) => g.status === "next");
  const results = mine.filter((g) => g.status === "final" && g.score.trim() !== "");

  const first = user.name.trim().split(/\s+/)[0] || user.username || "there";
  const scheduled = mine.length
    ? `${mine.length} match${mine.length === 1 ? "" : "es"} scheduled`
    : "no matches yet";

  return (
    <>
      <PageHeader title={`Hi, ${first}`} subtitle={<><TeamName /> · {scheduled}</>} />

      {live && (
        <section className="mb-4 overflow-hidden rounded-2xl bg-field p-6 text-white">
          <div className="flex justify-between text-sm"><StatusBadge status="live" /><span>{live.field}</span></div>
          <p className="mt-3 font-medium">{live.teamA} vs {live.teamB}</p>
          <p className="font-score text-7xl font-bold leading-none tabular-nums">{live.score}</p>
          <Link href="/player/schedule" className="mt-4 inline-block rounded-md bg-white px-4 py-2 font-bold text-[#14213d]">Follow live</Link>
        </section>
      )}

      {mine.length === 0 ? (
        <section className="mb-4 rounded-xl border border-line bg-card p-5 text-sm text-muted">
          No matches yet — your games appear here once an organizer schedules your team.
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {next && (
            <section className="rounded-xl border border-line bg-card p-5">
               <p className="text-sm font-bold text-brand">Next match</p>
              <p className="mt-2 font-score text-4xl font-bold">{next.time} · {next.field}</p>
              <p className="text-muted">{next.teamA} vs {next.teamB}</p>
            </section>
          )}
          <section className="rounded-xl border border-line bg-card p-5">
            <p className="text-sm font-bold text-brand">Results</p>
            {results.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {results.map((g) => (
                  <li key={g.id}>
                    <span className="font-score font-bold tabular-nums">{g.score}</span>{" "}
                    <span className="text-muted">{g.teamA} vs {g.teamB}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No results yet — finished scores show up here.</p>
            )}
          </section>
        </div>
      )}

      <section className="mt-4">
        <AnnouncementsFeed />
      </section>
    </>
  );
}
