// Shared Motion (motion/react) primitives for the marketing pages: one easing
// curve, one set of durations, and reduced-motion-aware variant factories so
// every section moves the same way. Pure data — no React, no JSX.

import type { Transition, Variants } from "motion/react";

/** easeOutExpo-style curve used for every entrance. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const DUR = {
  fast: 0.5,
  base: 0.65,
  slow: 0.8,
} as const;

/** Default stagger between siblings in a sequence. */
export const STAGGER = 0.1;

/** Shared scroll-reveal viewport: fire once, at 30% visibility. */
export const VIEWPORT = { once: true, amount: 0.3 } as const;

/** Spring for the live score-number swap (old exits up, new enters from below). */
export const SCORE_SPRING: Transition = { type: "spring", stiffness: 400, damping: 28 };

/** Spring for the numbered step circles popping in. */
export const POP_SPRING: Transition = { type: "spring", stiffness: 300, damping: 15 };

/**
 * Standard fade-up entrance. Reduced motion collapses the y movement so
 * users still get the fade without any displacement.
 */
export function fadeUp(reduced: boolean, distance = 24, delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR.base, ease: EASE, delay },
    },
  };
}

/** Empty container variant that just staggers its variant children. */
export function stagger(gap = STAGGER, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: gap, delayChildren } },
  };
}
