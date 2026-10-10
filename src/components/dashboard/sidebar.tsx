"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, signOut, type DemoSession } from "@/lib/auth";

export interface NavItem { href: string; label: string; also?: string[] }

export function Sidebar({ items, roleLabel, footer }: { items: NavItem[]; roleLabel: string; footer: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  const root = items[0].href;
  const isActive = (i: NavItem) =>
    i.href === root
      ? path === root || (i.also ?? []).some((p) => path.startsWith(p))
      : path.startsWith(i.href);

  // The session lives in localStorage, so it can only be read after mount —
  // reading it during render would not match the server-rendered HTML.
  useEffect(() => { setSession(getSession()); }, []);

  const logOut = () => {
    signOut();
    router.push("/login");
  };

  return (
    <aside className="workspace-sidebar flex items-center gap-2 overflow-x-auto p-4 md:min-h-screen md:flex-col md:items-stretch">
      <div className="workspace-brand flex items-center gap-3 pr-4 md:mb-8 md:block md:pr-0">
        <Link href="/" className="font-score text-3xl font-bold">Sidelines<span>.</span></Link>
        <p className="workspace-role hidden text-xs font-bold uppercase tracking-wide md:block">{roleLabel} workspace</p>
        <button type="button" onClick={logOut} className="workspace-logout whitespace-nowrap md:hidden">Log out <span>↗</span></button>
      </div>
      <p className="workspace-nav-label hidden md:block">Workspace</p>
      <nav className="workspace-nav flex items-center gap-2 md:block" aria-label={`${roleLabel} navigation`}>
      {items.map((i, index) => (
        <Link
          key={i.href}
          href={i.href}
          className={`workspace-nav-item whitespace-nowrap rounded-md border px-4 py-2.5 ${isActive(i) ? "is-active" : ""}`}
        >
          <span className="workspace-nav-index">0{index + 1}</span>
          {i.label}
        </Link>
      ))}
      </nav>
      <div className="hidden pt-6 text-sm text-muted md:mt-auto md:block">
        <p className="mb-2 text-xs uppercase tracking-wider">Signed in as</p>
        {/* `footer` is the workspace context (team name or org) — a node, so the
            player workspace can hand over a live team name. The person is
            whoever actually signed in, not a hard-coded demo name. */}
        <strong className="block text-fg">
          {session && <>{session.name} · </>}
          {footer}
        </strong>
        <button
          type="button"
          onClick={logOut}
          className="workspace-logout mt-4 cursor-pointer appearance-none border-0 bg-transparent p-0 text-left"
        >
          Log out <span>↗</span>
        </button>
      </div>
    </aside>
  );
}
