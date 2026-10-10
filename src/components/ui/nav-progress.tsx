"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Never let the bar blink past faster than this, so a fast page still reads as activity. */
const MIN_MS = 400;
/** Safety net for a click that never becomes a route change (e.g. a Ctrl+click we did start, then interrupted). */
const GUARD_MS = 5000;

/**
 * Indeterminate bar across the top of the viewport while a client-side
 * navigation is in flight.
 *
 * Driven by real signals rather than a timer: clicking an internal link starts
 * it (the navigation genuinely began) and the pathname changing is what stops
 * it. Programmatic redirects are deliberately not covered — there the
 * destination's `loading.tsx` is the feedback, and a bar that only appeared
 * once the page had already changed would just be noise.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };

  // Start on an internal link click.
  useEffect(() => {
    const start = () => {
      clearTimers();
      startedAt.current = Date.now();
      setActive(true);
      timers.current.push(
        setTimeout(() => {
          setActive(false);
          startedAt.current = 0;
        }, GUARD_MS)
      );
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;
      if (anchor.target && anchor.target !== "_self") return;

      // A link to the page you are already on is a no-op in Next.js — starting
      // the bar there would leave it spinning with nothing to wait for. Hash
      // links on the same path (scroll-only) are covered by the same check.
      const url = new URL(anchor.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  // The navigation landed: hold the bar for whatever remains of MIN_MS, then drop it.
  useEffect(() => {
    if (startedAt.current === 0) return;
    clearTimers();
    const remaining = Math.max(0, MIN_MS - (Date.now() - startedAt.current));
    timers.current.push(
      setTimeout(() => {
        setActive(false);
        startedAt.current = 0;
      }, remaining)
    );
  }, [pathname]);

  return (
    <div className="nav-progress" data-state={active ? "run" : "idle"} aria-hidden="true">
      <span />
    </div>
  );
}
