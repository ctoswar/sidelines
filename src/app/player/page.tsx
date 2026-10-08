import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { games, MY_TEAM } from "@/lib/mock-data";

export const metadata = { title: "Home – Sidelines" };

export default function PlayerHome() {
  const mine = games.filter((g) => g.teamA === MY_TEAM || g.teamB === MY_TEAM);
  const live = mine.find((g) => g.status === "live");
  const next = mine.find((g) => g.status === "next");

  return (
    <>
      <PageHeader title="Hi, Alex" subtitle={`${MY_TEAM} · Harbor Spring Open · Pool A`} />

      {live && (
        <section className="mb-4 overflow-hidden rounded-2xl bg-field p-6 text-white">
          <div className="flex justify-between text-sm"><StatusBadge status="live" /><span>{live.field}</span></div>
          <p className="mt-3 font-medium">{live.teamA} vs {live.teamB}</p>
          <p className="font-score text-7xl font-bold leading-none tabular-nums">{live.score}</p>
          <Link href="/player/schedule" className="mt-4 inline-block rounded-md bg-white px-4 py-2 font-bold text-[#14213d]">Follow live</Link>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {next && (
          <section className="rounded-xl border border-line bg-card p-5">
            <p className="text-sm font-bold text-brand">Next game</p>
            <p className="mt-2 font-score text-4xl font-bold">{next.time} AM · {next.field}</p>
            <p className="text-muted">{next.teamA} vs {next.teamB}</p>
          </section>
        )}
        <section className="rounded-xl border border-line bg-card p-5">
          <p className="text-sm font-bold text-brand">Pool A standing</p>
          <p className="mt-2 font-score text-4xl font-bold tabular-nums">1st · 1–0</p>
          <p className="text-muted">Points scored 11, against 9</p>
        </section>
      </div>

      <section className="mt-4">
        <AnnouncementsFeed />
      </section>
    </>
  );
}
