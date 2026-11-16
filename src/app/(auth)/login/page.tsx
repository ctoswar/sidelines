import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Log in – Sidelines" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell mode="login" next={next}>
      <h1 className="sr-only">Log in to Sidelines</h1>
      <LoginForm />
    </AuthShell>
  );
}
