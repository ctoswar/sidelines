"use client";

import { motion, type Variants } from "motion/react";
import { DUR, EASE, POP_SPRING, STAGGER, VIEWPORT, fadeUp } from "@/lib/motion";
import { MaskedLine } from "@/components/motion/primitives";
import { Divider } from "@/components/about/divider";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type Step = { title: string; body: string };

export function AboutSteps({ steps }: { steps: Step[] }) {
  return (
    <>
      <Divider />
      <section id="how" className="about-section mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-score text-4xl font-bold sm:text-5xl">
          <MaskedLine trigger="scroll">From signup to first serve in four steps</MaskedLine>
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <StepItem key={s.title} step={s} index={i} last={i === steps.length - 1} />
          ))}
        </ol>
      </section>
    </>
  );
}

function StepItem({ step, index, last }: { step: Step; index: number; last: boolean }) {
  const reduced = !!usePrefersReducedMotion();
  // Each step is offset by the global stagger; the connector line draws and
  // the copy fades a beat behind its circle.
  const base = index * STAGGER;

  const circleVariants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE, delay: base } },
      }
    : {
        hidden: { scale: 0 },
        visible: { scale: 1, transition: { ...POP_SPRING, delay: base } },
      };

  const lineVariants: Variants = reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE, delay: base + 0.3 } },
      }
    : {
        hidden: { scaleX: 0 },
        visible: { scaleX: 1, transition: { duration: DUR.base, ease: EASE, delay: base + 0.25 } },
      };

  return (
    <motion.li
      className="about-step"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={{ hidden: {}, visible: {} }}
    >
      {!last && (
        <motion.span
          aria-hidden="true"
          className="absolute left-[2.2rem] top-[2.35rem] h-px origin-left bg-line"
          style={{ width: "calc(100% - 2.2rem)" }}
          variants={lineVariants}
        />
      )}
      <motion.span
        className="about-step-badge"
        variants={circleVariants}
        whileHover={reduced ? undefined : { scale: 1.1, rotate: -6 }}
        transition={POP_SPRING}
      >
        {index + 1}
      </motion.span>
      <motion.h3 className="mt-1 font-bold" variants={fadeUp(reduced, 14, base + 0.35)}>
        {step.title}
      </motion.h3>
      <motion.p className="mt-1 text-muted" variants={fadeUp(reduced, 14, base + 0.45)}>
        {step.body}
      </motion.p>
    </motion.li>
  );
}
