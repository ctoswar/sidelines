"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { VIEWPORT, fadeUp, stagger } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * The final CTA. The background rings are real elements now (the old CSS
 * pseudo-element couldn't be animated): each slowly rotates with a faint arc
 * accent so the rotation reads, and drifts on a scroll-linked parallax.
 */
export function AboutCta() {
  const reduced = !!usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Rings drift ±40px in opposite directions as the section crosses the viewport.
  const yBig = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const ySmall = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  return (
    <section ref={ref} className="about-cta bg-field text-white">
      {/* Big ring: same position/styling as the old ::after, spinning clockwise. */}
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-[12rem] right-[8%] h-[30rem] w-[30rem]"
        style={{ y: reduced ? 0 : yBig }}
      >
        <Spin reduced={reduced} speed={60}>
          <RingFace borderOpacity={0.18} echo />
          <Arc dash="14 86" opacity={0.32} />
        </Spin>
      </motion.div>
      {/* Small companion ring, fainter, spinning the other way slower. */}
      <motion.div
        aria-hidden="true"
        className="absolute -left-[6rem] -top-[8rem] h-[18rem] w-[18rem]"
        style={{ y: reduced ? 0 : ySmall }}
      >
        <Spin reduced={reduced} speed={80} reverse>
          <RingFace borderOpacity={0.14} />
          <Arc dash="10 90" opacity={0.28} />
        </Spin>
      </motion.div>
      <motion.div
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={stagger(0.1)}
      >
        <motion.h2
          className="max-w-[20ch] font-score text-4xl font-bold leading-tight sm:text-5xl"
          variants={fadeUp(reduced)}
        >
          Your next tournament starts with one account.
        </motion.h2>
        <motion.div variants={fadeUp(reduced)}>
          <Link href="/signup" className="btn bg-white px-7 py-3 font-bold text-[#14213d]">
            Create a free account ↗
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** Continuous 0 -> 360 rotation, linear, optionally reversed. */
function Spin({
  reduced,
  speed,
  reverse,
  children,
}: {
  reduced: boolean;
  speed: number;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="absolute inset-0 will-change-transform"
      animate={reduced ? undefined : { rotate: reverse ? -360 : 360 }}
      transition={{ duration: speed, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

/** The bordered circle itself; `echo` reproduces the old double box-shadow halo. */
function RingFace({ borderOpacity, echo }: { borderOpacity: number; echo?: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        border: `1px solid rgba(255,255,255,${borderOpacity})`,
        boxShadow: echo
          ? "0 0 0 3rem rgba(255,255,255,0.03), 0 0 0 6rem rgba(255,255,255,0.03)"
          : undefined,
      }}
    />
  );
}

/** A faint arc accent on the ring — a full circle is rotationally symmetric, so this is what makes the spin visible. */
function Arc({ dash, opacity }: { dash: string; opacity: number }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <circle
        cx="50"
        cy="50"
        r="49.5"
        fill="none"
        stroke={`rgba(255,255,255,${opacity})`}
        strokeWidth={1}
        vectorEffect="nonScalingStroke"
        pathLength={100}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}
