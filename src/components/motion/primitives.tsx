"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { DUR, EASE, SCORE_SPRING, VIEWPORT, fadeUp } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const MOTION_TAGS = { div: motion.div, p: motion.p, span: motion.span } as const;
type RevealTag = keyof typeof MOTION_TAGS;

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay in seconds, useful to sequence behind a headline. */
  delay?: number;
  /** Movement distance in px; reduced-motion visitors get 0 regardless. */
  distance?: number;
  as?: RevealTag;
};

/**
 * <Reveal> — the workhorse fade-up for paragraphs, cards and columns.
 * Fires once when 30% of the element scrolls into view; reduced motion
 * falls back to a pure opacity fade with no movement.
 */
export function Reveal({ children, className, delay = 0, distance = 24, as = "div" }: RevealProps) {
  const reduced = !!usePrefersReducedMotion();
  const Tag = MOTION_TAGS[as];

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={fadeUp(reduced, distance, delay)}
    >
      {children}
    </Tag>
  );
}

type MaskedLineProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** "load" animates on mount (above-the-fold hero copy); "scroll" waits for the line to enter the viewport. */
  trigger?: "load" | "scroll";
};

/**
 * <MaskedLine> — one line of text revealed by an overflow-hidden wrapper,
 * sliding from 110% to 0. The wrapper carries a small padding-bottom with a
 * matching negative margin so descenders (y, p, g) survive the clip without
 * shifting the layout.
 */
export function MaskedLine({ children, className, delay = 0, trigger = "load" }: MaskedLineProps) {
  const reduced = !!usePrefersReducedMotion();
  // Reduced motion: no movement, just a fade inside the mask.
  const start = reduced ? { opacity: 0 } : { y: "110%" };
  const end = reduced ? { opacity: 1 } : { y: "0%" };

  return (
    <span className="block overflow-hidden [padding-bottom:0.14em] [margin-bottom:-0.14em]">
      <motion.span
        className={`block ${className ?? ""}`}
        initial={start}
        {...(trigger === "scroll" ? { whileInView: end, viewport: VIEWPORT } : { animate: end })}
        transition={{ duration: DUR.slow, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

type AnimatedNumberProps = {
  value: number;
  className?: string;
};

/**
 * <AnimatedNumber> — swap-in number for the live scoreboard. The old value
 * exits upward, the new one enters from below on a quick spring with a
 * slight scale bump. Screen-reader callers wrap this in aria-hidden and
 * announce the value separately.
 */
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const reduced = !!usePrefersReducedMotion();

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block will-change-transform"
          initial={reduced ? { opacity: 0 } : { y: "60%", opacity: 0, scale: 0.85 }}
          animate={{ y: "0%", opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { y: "-60%", opacity: 0 }}
          transition={SCORE_SPRING}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
