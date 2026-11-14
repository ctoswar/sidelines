"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import { DUR, EASE, VIEWPORT, stagger } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const MotionLink = motion.create(Link);

/** Text reveals in this section fire once, at 40% visibility. */
const VP = { once: true, amount: 0.4 } as const;

/** Shadow under the button while it is lifted on hover. */
const LIFT_SHADOW = "0 12px 28px rgba(0,0,0,0.35)";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * SSR-safe "has a precise pointer" flag. The magnetic pull only makes sense
 * with a cursor to follow, so touch and pen devices never get it. The
 * non-magnetic branch renders first so server and client HTML match.
 */
function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setFine(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return fine;
}

/**
 * The final CTA, rebuilt as one choreographed scene.
 *
 * The rings are a single SVG pinned to the section's vertical centre and
 * pushed off the left edge so ~60% stays on stage — a deliberate crop that
 * lines up with the copy instead of floating away from it. Every rotating
 * layer carries something the eye can track (dashes, a lime arc, an orbiting
 * ball) so the motion reads, and each pivots on the true ring centre via
 * `transform-box: fill-box`. Rotations pause while the section is off-screen,
 * the whole scene drifts on a scroll parallax, and the copy reveals with
 * masked lines before the button rises into place.
 */
export function AboutCta() {
  const reduced = !!usePrefersReducedMotion();
  const fine = usePointerFine();
  const ref = useRef<HTMLElement>(null);

  // Rotation gate: spin only while the section is on screen (CPU) and the
  // visitor allows motion.
  const inView = useInView(ref);
  const spinning = inView && !reduced;

  // Scroll parallax: the ring scene slides down 80px as the section crosses
  // the viewport; the dashed ring slides back the other way a little so the
  // layers separate in depth.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yRings = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const yDashed = useTransform(scrollYProgress, [0, 1], [14, -14]);

  // Magnetic pull (precise pointers only): springs chase the cursor, capped
  // at 8px, and settle back to zero on leave.
  const magnetX = useMotionValue(0);
  const magnetY = useMotionValue(0);
  const pullX = useSpring(magnetX, { stiffness: 220, damping: 22, mass: 0.4 });
  const pullY = useSpring(magnetY, { stiffness: 220, damping: 22, mass: 0.4 });

  // Hover state for the lime wipe: children of a motion.create() component
  // don't inherit variant labels reliably, so the wipe is driven directly by
  // animate instead of riding the parent's hover variant.
  const [hovered, setHovered] = useState(false);

  const attract = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const reachX = ((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 8;
    const reachY = ((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 8;
    magnetX.set(clamp(reachX, -8, 8));
    magnetY.set(clamp(reachY, -8, 8));
  };
  const release = () => {
    magnetX.set(0);
    magnetY.set(0);
  };

  // Rings: soft scale-in on first view; reduced motion keeps the fade only.
  const ringsVariants: Variants = {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: EASE } },
  };

  // Headline: masked line reveal, one beat apart.
  const lineVariants: Variants = {
    hidden: reduced ? { opacity: 0 } : { y: "110%" },
    visible: { opacity: 1, y: "0%", transition: { duration: DUR.slow, ease: EASE } },
  };

  // Button: hover lift + shadow and tap dip are self-contained variant labels
  // (they apply to the link itself, which works); the entrance lives on a
  // native wrapper below, and the wipe/arrow handle their own choreography.
  const buttonVariants: Variants = {
    hover: reduced
      ? { boxShadow: LIFT_SHADOW, transition: { duration: 0.2 } }
      : { y: -2, boxShadow: LIFT_SHADOW, transition: { duration: 0.2, ease: EASE } },
    tap: reduced ? {} : { scale: 0.97, transition: { duration: 0.12 } },
  };

  const arrowVariants: Variants = {
    visible: { x: 0, y: 0 },
    hover: reduced ? { x: 0, y: 0 } : { x: 2, y: -2, transition: { duration: 0.2, ease: EASE } },
  };

  return (
    <section ref={ref} className="about-cta relative overflow-hidden bg-field py-24 text-white md:py-32">
      {/*
        The ring scene: vertically centred on the section and pushed off the
        left edge so ~60% of it stays on stage. Smaller and dimmer on mobile
        so the copy keeps the stage.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-10rem] top-1/2 z-0 w-[26rem] -translate-y-1/2 sm:left-[-12rem] sm:w-[32rem] lg:left-[-18rem] lg:w-[45rem]"
      >
        <motion.div
          className="w-full"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={ringsVariants}
          style={{ y: reduced ? 0 : yRings }}
        >
          <svg viewBox="0 0 800 800" className="h-auto w-full opacity-50 md:opacity-100">
            {/* a. The thick soft band the whole scene sits on. */}
            <circle cx="400" cy="400" r="340" fill="none" stroke="white" strokeOpacity={0.045} strokeWidth={48} />
            {/* b. Dashed ring: slowest, counter-clockwise, with counter-parallax. */}
            <motion.g style={{ y: reduced ? 0 : yDashed }}>
              <Orbit active={spinning} dir={-1} duration={90}>
                <circle
                  cx="400"
                  cy="400"
                  r="290"
                  fill="none"
                  stroke="white"
                  strokeOpacity={0.15}
                  strokeWidth={1}
                  strokeDasharray="2 14"
                />
              </Orbit>
            </motion.g>
            {/* c. Thin base ring + the lime arc that makes its clockwise spin read
                (dash 345.6/1036.7 ≈ 25% of the 2π·220 circumference). */}
            <Orbit active={spinning} dir={1} duration={40}>
              <circle cx="400" cy="400" r="220" fill="none" stroke="white" strokeOpacity={0.1} strokeWidth={1} />
              <circle
                cx="400"
                cy="400"
                r="220"
                fill="none"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="345.6 1036.7"
                transform="rotate(-90 400 400)"
                style={{ stroke: "var(--desk-acid)", strokeOpacity: 0.7 }}
              />
            </Orbit>
            {/* d. The pickleball: one lime dot with a soft glow, orbiting ring b. */}
            <Orbit active={spinning} dir={1} duration={24}>
              {/* Invisible geometry keeps the group's fill-box centred on the ring
                  centre, so transform-origin: center pivots the orbit, not the dot. */}
              <circle cx="400" cy="400" r="290" fill="none" stroke="none" />
              <circle
                cx="400"
                cy="110"
                r="14"
                style={{ fill: "var(--desk-acid)", fillOpacity: 0.35, filter: "blur(7px)" }}
              />
              <circle
                cx="400"
                cy="110"
                r="6"
                style={{
                  fill: "var(--desk-acid)",
                  filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--desk-acid) 70%, transparent))",
                }}
              />
            </Orbit>
          </svg>
        </motion.div>
      </div>

      <div className="about-cta-content relative z-10 mx-auto flex max-w-6xl flex-col items-start gap-10 px-5 md:flex-row md:items-center md:justify-between md:gap-12">
        <div>
          <motion.h2
            className="font-score text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[0.95] tracking-tight"
            initial="hidden"
            whileInView="visible"
            viewport={VP}
            variants={stagger(0.1)}
          >
            <span className="block overflow-hidden [padding-bottom:0.14em] [margin-bottom:-0.14em]">
              <motion.span className="block" variants={lineVariants}>
                Your next tournament
              </motion.span>
            </span>
            <span className="block overflow-hidden [padding-bottom:0.14em] [margin-bottom:-0.14em]">
              <motion.span className="block" variants={lineVariants}>
                starts with one account.
              </motion.span>
            </span>
          </motion.h2>
          <motion.p
            className="mt-6 text-sm text-white/60"
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VP}
            transition={{ duration: DUR.base, ease: EASE, delay: 0.25 }}
          >
            Free for up to 8 teams. No card needed.
          </motion.p>
        </div>

        {/*
          The button arrives 0.4s after the headline (entrance on this native
          wrapper, so un-hovering later reverts with no delay), rides the
          magnetic pull, and the link carries the hover/tap choreography.
        */}
        <motion.div
          className="w-full shrink-0 md:w-auto"
          style={fine ? { x: pullX, y: pullY } : undefined}
          {...(fine ? { onMouseMove: attract, onMouseLeave: release } : {})}
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VP}
            transition={{ duration: DUR.base, ease: EASE, delay: 0.4 }}
          >
            <MotionLink
              href="/signup"
              variants={buttonVariants}
              whileHover="hover"
              whileTap={reduced ? undefined : "tap"}
              onHoverStart={() => setHovered(true)}
              onHoverEnd={() => setHovered(false)}
              className="btn relative flex w-full items-center justify-center gap-1.5 overflow-hidden bg-white px-7 py-3 font-bold text-[#14213d] md:w-auto"
            >
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 origin-bottom"
                style={{ background: "var(--desk-acid)" }}
                initial={reduced ? { opacity: 0 } : { scaleY: 0 }}
                animate={
                  reduced
                    ? { opacity: hovered ? 1 : 0, transition: { duration: 0.25 } }
                    : {
                        scaleY: hovered ? 1 : 0,
                        transition: { duration: hovered ? 0.35 : 0.25, ease: EASE },
                      }
                }
              />
              <span className="relative">Create a free account</span>
              <motion.span aria-hidden="true" variants={arrowVariants} className="relative inline-block">
                ↗
              </motion.span>
            </MotionLink>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * One rotating layer. Motion drives the angle (linear, endless) while the
 * group pivots on its own bounding-box centre — every Orbit's content is
 * centred on (400,400), so `center` really is the ring centre. `active` is
 * the on-screen gate: while it is false the angle snaps back to 0, which is
 * free and invisible because it only ever happens off-screen.
 */
function Orbit({
  active,
  dir,
  duration,
  children,
}: {
  active: boolean;
  dir: 1 | -1;
  duration: number;
  children: ReactNode;
}) {
  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      animate={active ? { rotate: dir * 360 } : { rotate: 0 }}
      transition={active ? { duration, ease: "linear", repeat: Infinity } : { duration: 0 }}
    >
      {children}
    </motion.g>
  );
}
