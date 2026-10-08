import Link from "next/link";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const features = [
  { title: "Score from the sideline", body: "Large tap targets, one-tap undo, timeouts and soft or hard cap timers. Works offline and syncs when you get signal back.", border: "border-brand" },
  { title: "Spectators need no account", body: "Share one link or QR code. Anyone can follow live games, schedules and field changes from their phone.", border: "border-flag" },
  { title: "Standings that fix themselves", body: "Edit a score and pool tables, tie-breakers and bracket seeding recalculate instantly.", border: "border-brand" },
];

const steps = [
  { title: "Create the tournament", body: "Name it, pick divisions and game rules." },
  { title: "Add teams", body: "Type them in or import a CSV roster." },
  { title: "Invite scorekeepers", body: "Assign each one to a field by email." },
  { title: "Share the live link", body: "Post it once. Everyone stays up to date." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="about-page">
        <section className="about-hero mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="about-eyebrow">The tournament operating system</p>
            <h1 className="mt-3 font-score text-6xl font-bold leading-[0.9] tracking-tight sm:text-8xl">
              Every point counted.<br /><em>Every field in sync.</em>
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted">
              Run your ultimate tournament from the sideline. Scorekeepers tap a goal, and standings,
              brackets and spectator pages update before the next pull.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-pri">Create a tournament ↗</Link>
              <a href="#features" className="btn">See what&apos;s included</a>
            </div>
            <p className="mt-4 text-sm text-muted">Free for up to 8 teams. No card needed.</p>
          </div>
          <div className="about-scoreboard"><LiveScoreboard /></div>
        </section>

        <section id="features" className="about-section mx-auto max-w-6xl border-t border-line px-5 py-20">
          <h2 className="max-w-[18ch] font-score text-4xl font-bold leading-tight sm:text-5xl">
            Built for the people holding the phone
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className={`about-feature border-l-4 pl-5 ${f.border}`}>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="about-section mx-auto max-w-6xl border-t border-line px-5 py-20">
          <h2 className="font-score text-4xl font-bold sm:text-5xl">From signup to first pull in four steps</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="about-step">
                <span className="font-score text-5xl font-bold text-brand">{i + 1}</span>
                <h3 className="mt-1 font-bold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="about-cta bg-field text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-16">
            <h2 className="max-w-[20ch] font-score text-4xl font-bold leading-tight sm:text-5xl">
              Your next tournament starts with one account.
            </h2>
              <Link href="/signup" className="btn bg-white px-7 py-3 font-bold text-[#14213d]">Create a free account ↗</Link>
          </div>
        </section>
      </main>
      <SiteFooter className="about-footer" />
    </>
  );
}
