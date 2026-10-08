import Link from "next/link";

interface Props {
  mode: "login" | "signup";
  aside?: { title: string; body: string };
  next?: string;
  children: React.ReactNode;
}

export function AuthShell({ mode, aside, next, children }: Props) {
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  const tab = (active: boolean) =>
    `flex-1 border-b-4 py-3 text-center font-bold ${active ? "border-brand text-fg" : "border-transparent text-muted"}`;

  return (
    <div className="auth-page grid min-h-screen lg:grid-cols-[.85fr_1.15fr]">
      <aside className="auth-aside hidden flex-col justify-between p-12 text-white lg:flex">
        <Link href="/" className="font-score text-3xl font-bold">Sidelines<span>.</span></Link>
        <div>
          {aside ? (
            <p className="auth-aside-title font-score text-7xl font-bold leading-[0.95]">{aside.title}</p>
          ) : (
            <p className="font-score text-[10rem] font-bold leading-none tabular-nums">
              15<span className="text-white/40">–</span>13
            </p>
          )}
          <p className="mt-4 max-w-[38ch] text-white/80">
            {aside?.body ?? "Final score, entered on the sideline and live for everyone within seconds."}
          </p>
        </div>
        <span />
      </aside>

      <section className="auth-content flex items-center justify-center p-6 sm:p-10">
        <div className="auth-card w-full max-w-md py-8">
          <Link href="/" className="mb-6 block font-score text-3xl font-bold lg:hidden">Sidelines<span>.</span></Link>
          <div className="auth-tabs mb-8 flex border-b border-line">
            <Link href={`/login${suffix}`} className={tab(mode === "login")}>Log in</Link>
            <Link href={`/signup${suffix}`} className={tab(mode === "signup")}>Sign up</Link>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
