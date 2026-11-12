"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe prefers-reduced-motion flag.
 *
 * Motion's own useReducedMotion() reads the media query synchronously, so for
 * a reduced-motion visitor it returns true on the very first client render —
 * contradicting the server HTML (the server can't see the media query) and
 * tripping a React hydration mismatch. This hook instead renders the
 * non-reduced branch first, byte-identical to the server, then flips after
 * mount: a legal post-hydration update. Everything still animating at that
 * point is below the fold, so those reveals pick up the no-movement variants.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
