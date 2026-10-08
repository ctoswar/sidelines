import Link from "next/link";
import { AuthShell } from "@/features/auth/auth-shell";

export const metadata = { title: "Sign up – Sidelines" };

const roles = [
  { href: "/signup/player", title: "I'm a player", body: "Join a team, see your schedule and follow live scores." },
  { href: "/signup/organizer", title: "I'm an organizer", body: "Create tournaments, manage teams and invite scorekeepers." },
];

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell mode="signup" next={next}>
      <h1 className="font-score text-5xl font-bold">Create your account</h1>
      <p className="mb-6 mt-2 text-muted">How will you use Sidelines?</p>
      <div className="space-y-3">
          {roles.map((r) => (
          <Link key={r.href} href={`${r.href}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="block rounded-xl border-2 border-line bg-card p-5 hover:border-brand">
            <p className="font-score text-3xl font-bold">{r.title}</p>
            <p className="mt-1 text-muted">{r.body}</p>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Scorekeepers don&apos;t sign up here. Organizers invite them by email.</p>
    </AuthShell>
  );
}
