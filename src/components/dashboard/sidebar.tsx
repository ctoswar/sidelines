"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem { href: string; label: string; also?: string[] }

export function Sidebar({ items, roleLabel, footer }: { items: NavItem[]; roleLabel: string; footer: string }) {
  const path = usePathname();
  const root = items[0].href;
  const isActive = (i: NavItem) =>
    i.href === root
      ? path === root || (i.also ?? []).some((p) => path.startsWith(p))
      : path.startsWith(i.href);

  return (
    <aside className="workspace-sidebar flex items-center gap-2 overflow-x-auto p-4 md:min-h-screen md:flex-col md:items-stretch">
      <div className="workspace-brand pr-4 md:mb-8 md:pr-0">
        <Link href="/" className="font-score text-3xl font-bold">Sidelines<span>.</span></Link>
        <p className="workspace-role hidden text-xs font-bold uppercase tracking-wide md:block">{roleLabel} workspace</p>
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
        <strong className="block text-fg">{footer}</strong>
        <Link href="/" className="workspace-logout mt-4 inline-block">Log out <span>↗</span></Link>
      </div>
    </aside>
  );
}
