"use client";

import { motion } from "motion/react";
import { DUR, EASE, VIEWPORT } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * Full-container-width divider that draws itself (scaleX 0 -> 1, anchored
 * left) when it scrolls into view. Replaces the old `border-t` borders,
 * which can't be transform-animated.
 */
export function Divider() {
  const reduced = !!usePrefersReducedMotion();

  return (
    <div className="mx-auto max-w-6xl" aria-hidden="true">
      <motion.div
        className="h-px origin-left bg-line"
        initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
        whileInView={reduced ? { opacity: 1 } : { scaleX: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: DUR.slow, ease: EASE }}
      />
    </div>
  );
}
