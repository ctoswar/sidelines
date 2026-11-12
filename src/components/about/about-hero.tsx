"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { EASE, DUR, stagger } from "@/lib/motion";
import { MaskedLine, Reveal } from "@/components/motion/primitives";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

// Headline choreography: the two dark lines stagger in, then the orange
// sentence lands a beat later so it reads as the payoff.
const LINE_DELAYS = [0.08, 0.18, 0.5, 0.62];

export function AboutHero() {
  const reduced = !!usePrefersReducedMotion();

  // Buttons: entrance is variant-driven so the container can stagger them;
  // hover lifts 2px with a soft shadow, tap dips to 0.97, and the ↗ arrow
  // nudges up-right with the parent's hover variant. Reduced motion keeps
  // the shadow feedback but drops every transform.
  const buttonVariants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
    hover: reduced
      ? { boxShadow: "0 10px 24px rgba(23,35,31,0.16)", transition: { duration: 0.2 } }
      : { y: -2, boxShadow: "0 10px 24px rgba(23,35,31,0.16)", transition: { duration: 0.2, ease: EASE } },
    tap: reduced ? {} : { scale: 0.97, transition: { duration: 0.12 } },
  };

  const arrowVariants: Variants = {
    hover: reduced ? {} : { x: 2, y: -2, transition: { duration: 0.2, ease: EASE } },
  };

  return (
    <section className="about-hero mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <Reveal as="p" className="about-eyebrow">
          The pickleball tournament operating system
        </Reveal>
        <h1 className="mt-3 font-score text-6xl font-bold leading-[0.9] tracking-tight sm:text-8xl">
          <MaskedLine delay={LINE_DELAYS[0]}>Every point</MaskedLine>
          <MaskedLine delay={LINE_DELAYS[1]}>counted.</MaskedLine>
          <MaskedLine delay={LINE_DELAYS[2]}>
            <em>Every court in</em>
          </MaskedLine>
          <MaskedLine delay={LINE_DELAYS[3]}>
            <em>sync.</em>
          </MaskedLine>
        </h1>
        <Reveal as="p" className="mt-6 max-w-[46ch] text-lg leading-relaxed text-muted" delay={0.75}>
          Run your pickleball tournament from the sideline. Scorekeepers tap a point, and standings,
          brackets and spectator pages update before the next serve.
        </Reveal>
        <motion.div
          className="mt-8 flex flex-wrap gap-3"
          initial="hidden"
          animate="visible"
          variants={stagger(0.1, 0.86)}
        >
          <motion.div variants={buttonVariants} whileHover="hover" whileTap={reduced ? undefined : "tap"} className="inline-flex">
            <Link href="/signup" className="btn btn-pri">
              Create a tournament{" "}
              <motion.span aria-hidden="true" variants={arrowVariants} className="inline-block">
                ↗
              </motion.span>
            </Link>
          </motion.div>
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" className="inline-flex">
            <a href="#features" className="btn">See what&apos;s included</a>
          </motion.div>
        </motion.div>
        <Reveal as="p" className="mt-4 text-sm text-muted" delay={1.05}>
          Free for up to 8 teams. No card needed.
        </Reveal>
      </div>
      <ScoreboardSpot />
    </section>
  );
}

/**
 * The live demo card: entrance (scale/opacity/y), the lime offset block
 * sliding in behind it, and a gentle infinite float that both the card and
 * its shadow ride together so they never separate.
 */
function ScoreboardSpot() {
  const reduced = !!usePrefersReducedMotion();

  return (
    <div className="about-scoreboard">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: DUR.slow, ease: EASE, delay: 0.3 }}
      >
        <motion.div
          className="relative will-change-transform"
          animate={reduced ? undefined : { y: [0, -6, 0] }}
          transition={reduced ? undefined : { duration: 4, ease: "easeInOut", repeat: Infinity, delay: 1.2 }}
        >
          {/* The old 14px CSS box-shadow, as a real block so it can slide in from 12px short of its final offset. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-[1.25rem]"
            style={{ background: "var(--desk-acid)" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 2, y: 2 }}
            animate={{ opacity: 1, x: 14, y: 14 }}
            transition={{ duration: DUR.base, ease: EASE, delay: 0.55 }}
          />
          <LiveScoreboard />
        </motion.div>
      </motion.div>
    </div>
  );
}
