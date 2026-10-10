"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession, homeFor, signOut, type DemoSession } from "@/lib/auth";

/**
 * The public marketing header (landing, About, and every event page).
 *
 * It used to hard-code "Log in / Sign up", so a signed-in player who wandered
 * back to / or to an event page was cheerfully told to log in again — the
 * workspace knew exactly who they were, the public site did not. `EventShell`
 * already tracked the session for the Register button; only this was stale.
 *
 * The session lives in localStorage, so the signed-out markup renders first —
 * identical to the server HTML, so there is no hydration mismatch — and is
 * swapped after mount if a session turns up.
 */
export function SiteHeader() {
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => { setSession(getSession()); }, []);

  // Staying put: everything here is public. Only the header flips back.
  const logOut = () => {
    signOut();
    setSession(null);
  };

  return (
    <header className="bg-field text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="font-score text-3xl font-bold tracking-tight">Sidelines</Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">Events</Link>
          <Link href="/about" className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">About</Link>
          {session ? (
            <>
              <span className="hidden max-w-[11rem] truncate px-3 text-white/80 md:inline-block">{session.name}</span>
              <button type="button" onClick={logOut} className="rounded-md border border-white/30 px-4 py-2 hover:bg-white/10">
                Log out
              </button>
              <Link href={homeFor(session.role)} className="rounded-md bg-white px-4 py-2 font-bold text-[#14213d]">
                My workspace
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md border border-white/30 px-4 py-2 hover:bg-white/10">Log in</Link>
              <Link href="/signup" className="rounded-md bg-white px-4 py-2 font-bold text-[#14213d]">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
