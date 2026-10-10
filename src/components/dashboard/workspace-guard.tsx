"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, homeFor, type Role } from "@/lib/auth";
import { LoadingDots } from "@/components/ui/loading-dots";

/**
 * Puts a workspace behind a demo session.
 *
 * Children are rendered on the first paint because they are statically
 * prerendered and localStorage is not readable on the server — gating them
 * behind a spinner would blank every workspace page on load. Once the effect
 * runs we either confirm the session or swap the shell for a redirect screen,
 * so a signed-out visitor never keeps looking at someone else's workspace.
 */
export function WorkspaceGuard({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"pending" | "ok" | "denied">("pending");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setState("denied");
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (session.role !== role) {
      setState("denied");
      router.replace(homeFor(session.role));
    } else {
      setState("ok");
    }
  }, [router, pathname, role]);

  if (state === "denied") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <LoadingDots label="Checking your session" />
          <p className="mt-3 text-sm text-muted">Taking you to the right place…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
