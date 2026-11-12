"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { homeFor, signOut, useSession } from "@/lib/auth";
import { DUR, EASE } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const MotionLink = motion.create(Link);

/**
 * The public marketing header (landing, About, and every event page).
 *
 * It used to hard-code "Log in / Sign up", so a signed-in player who wandered
 * back to / or to an event page was cheerfully told to log in again — the
 * workspace knew exactly who they were, the public site did not. `EventShell`
 * already tracked the session for the Register button; only this was stale.
 *
 * The session is server-backed, so the signed-out markup renders first —
 * identical to the server HTML, so there is no hydration mismatch — and is
 * swapped once useSession() resolves.
 */
export function SiteHeader() {
  const session = useSession();
  const reduced = !!usePrefersReducedMotion();

  // Staying put: everything here is public. Only the header flips back.
  const logOut = () => {
    void signOut();
  };

  // The whole bar slides down on load; reduced motion gets a plain fade.
  const headerVariants: Variants = {
    hidden: reduced ? { opacity: 0 } : { y: "-100%", opacity: 0 },
    visible: { y: "0%", opacity: 1, transition: { duration: DUR.base, ease: EASE } },
  };

  // Nav links fade in just after the bar lands.
  const navVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : -6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  // Sign up / My workspace share the same hover-tap micro-interaction.
  const ctaProps = reduced ? {} : { whileHover: { scale: 1.04 }, whileTap: { scale: 0.96 } };

  return (
    <motion.header
      className="bg-field text-white"
      initial="hidden"
      animate="visible"
      variants={headerVariants}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <MotionLink href="/" variants={itemVariants} className="font-score text-3xl font-bold tracking-tight">
          Sidelines
        </MotionLink>
        <motion.nav className="flex items-center gap-1 text-sm font-medium" variants={navVariants}>
          <MotionLink href="/" variants={itemVariants} className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">
            Events
          </MotionLink>
          <MotionLink href="/about" variants={itemVariants} className="hidden px-3 py-2 text-white/80 hover:text-white sm:inline">
            About
          </MotionLink>
          {session ? (
            <>
              <motion.span
                variants={itemVariants}
                className="hidden max-w-[11rem] truncate px-3 text-white/80 md:inline-block"
              >
                {session.name}
              </motion.span>
              <motion.button
                type="button"
                onClick={logOut}
                variants={itemVariants}
                className="rounded-md border border-white/30 px-4 py-2 hover:bg-white/10"
              >
                Log out
              </motion.button>
              <MotionLink
                href={homeFor(session.role)}
                {...ctaProps}
                variants={itemVariants}
                className="rounded-md bg-white px-4 py-2 font-bold text-[#14213d]"
              >
                My workspace
              </MotionLink>
            </>
          ) : (
            <>
              <MotionLink
                href="/login"
                variants={itemVariants}
                className="rounded-md border border-white/30 px-4 py-2 hover:bg-white/10"
              >
                Log in
              </MotionLink>
              <MotionLink
                href="/signup"
                {...ctaProps}
                variants={itemVariants}
                className="rounded-md bg-white px-4 py-2 font-bold text-[#14213d]"
              >
                Sign up
              </MotionLink>
            </>
          )}
        </motion.nav>
      </div>
    </motion.header>
  );
}
