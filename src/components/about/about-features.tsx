"use client";

import { motion, type Variants } from "motion/react";
import { EASE, DUR, STAGGER, VIEWPORT, fadeUp, stagger } from "@/lib/motion";
import { MaskedLine } from "@/components/motion/primitives";
import { Divider } from "@/components/about/divider";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type Feature = { title: string; body: string; bar: string };

export function AboutFeatures({ features }: { features: Feature[] }) {
  const reduced = !!usePrefersReducedMotion();

  return (
    <>
      <Divider />
      <section id="features" className="about-section mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-[18ch] font-score text-4xl font-bold leading-tight sm:text-5xl">
          <MaskedLine trigger="scroll">Built for the people</MaskedLine>
          <MaskedLine trigger="scroll" delay={0.1}>holding the phone</MaskedLine>
        </h2>
        <motion.div
          className="mt-10 grid gap-10 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={stagger(STAGGER)}
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              className="about-feature relative pl-6 pr-4"
              variants={featureVariants(reduced)}
              whileHover="hover"
            >
              {/* The colored left border as a real element so it can grow from scaleY 0. */}
              <motion.span
                aria-hidden="true"
                className={`absolute left-0 top-0 h-full w-1 origin-top ${f.bar}`}
                variants={barVariants(reduced)}
              />
              <motion.h3 className="text-lg font-bold" variants={titleVariants()}>
                {f.title}
              </motion.h3>
              <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </>
  );
}

// Column: fade up on scroll, shift 4px right on hover (reduced: fade only).
function featureVariants(reduced: boolean): Variants {
  return {
    ...fadeUp(reduced),
    hover: reduced ? {} : { x: 4, transition: { duration: 0.25, ease: EASE } },
  };
}

// Border strip: grows top-down slightly after its column starts entering.
function barVariants(reduced: boolean): Variants {
  return reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE, delay: 0.15 } },
      }
    : {
        hidden: { scaleY: 0 },
        visible: { scaleY: 1, transition: { duration: DUR.slow, ease: EASE, delay: 0.15 } },
      };
}

// Title brightens on hover — ink lightened via opacity (opacity fade is allowed under reduced motion).
function titleVariants(): Variants {
  return {
    hover: { opacity: 0.72, transition: { duration: 0.2 } },
  };
}
