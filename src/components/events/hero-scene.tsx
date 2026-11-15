"use client";

import dynamic from "next/dynamic";

// The Three.js diorama is ~350 KB of decorative art. Loading it statically
// pulled the whole library into the homepage's critical JS; this wrapper
// defers it until after hydration. It renders nothing server-side, so the
// hero's layout is unchanged and reduced-motion visitors (who never animate)
// still pay the download — acceptable for one chunk, cached after that.
const PickleballScene = dynamic(
  () => import("./pickleball-scene").then((mod) => mod.PickleballScene),
  { ssr: false },
);

export function HeroScene() {
  return <PickleballScene />;
}
