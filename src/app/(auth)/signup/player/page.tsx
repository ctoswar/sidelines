import Link from "next/link";
import { AuthShell } from "@/features/auth/auth-shell";
import { PlayerSignupForm } from "@/features/auth/player-signup-form";

export const metadata = { title: "Player sign up – Sidelines" };

export default async function PlayerSignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
      <AuthShell mode="signup" next={next} wide aside={{ title: "Find your game. Follow your team.", body: "Join your team with a code, see your schedule, and get notified when your match moves courts." }}>
      <Link href="/signup" className="mb-3 inline-block text-sm text-muted">← Change role</Link>
      <h1 className="font-score text-5xl font-bold">Player registration</h1>
       <p className="mb-5 mt-2 text-muted">Build your pickleball profile and tell us how you play.</p>
      <PlayerSignupForm redirectTo={next} />
    </AuthShell>
  );
}
