import Link from "next/link";
import { AuthShell } from "@/features/auth/auth-shell";
import { OrganizerSignupForm } from "@/features/auth/organizer-signup-form";

export const metadata = { title: "Organizer sign up – Sidelines" };

export default async function OrganizerSignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell mode="signup" next={next} aside={{ title: "Run the whole tournament.", body: "Create tournaments, build schedules, invite scorekeepers and share one live link with everyone." }}>
      <Link href="/signup" className="mb-3 inline-block text-sm text-muted">← Change role</Link>
      <h1 className="font-score text-5xl font-bold">Organizer registration</h1>
      <p className="mb-5 mt-2 text-muted">Tell us about your organization.</p>
      <OrganizerSignupForm />
    </AuthShell>
  );
}
