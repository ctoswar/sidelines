"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollBus } from "@/lib/scroll-bus";

// The scroll layer for the public events page: Lenis smooth scrolling driven
// by the GSAP ticker, ScrollTrigger scrubs/reveals, and a velocity feed into
// the Three.js scene via scrollBus. Skipped entirely for reduced-motion
// visitors — they keep the CSS load reveals and native scrolling. Scoped to
// this page on purpose: dashboards keep plain native scroll.
gsap.registerPlugin(ScrollTrigger);

export function ScrollExperience() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // GSAP owns entrance/scroll motion from here on — silence the CSS
    // desk-reveal load animations so their fill-mode doesn't fight
    // ScrollTrigger transforms.
    document.documentElement.classList.add("scroll-exp");

    const lenis = new Lenis({ lerp: 0.11 });
    lenis.on("scroll", (event: Lenis) => {
      ScrollTrigger.update();
      scrollBus.velocity = event.velocity;
    });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      // ── Hero scrub: intro drifts, the diorama recedes into the paper ────
      ScrollTrigger.create({
        trigger: ".events-hero",
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => {
          scrollBus.heroProgress = self.progress;
        },
      });
      gsap.to(".events-hero-intro", {
        yPercent: -14,
        ease: "none",
        scrollTrigger: { trigger: ".events-hero", start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".events-hero-scene", {
        yPercent: -34,
        scale: 0.94,
        ease: "none",
        scrollTrigger: { trigger: ".events-hero", start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".events-page-grid", {
        yPercent: 14,
        ease: "none",
        scrollTrigger: { trigger: ".events-page", start: "top top", end: "bottom top", scrub: true },
      });

      // ── Entrance (replaces the CSS load reveal, staggered) ──────────────
      // opacity, not autoAlpha: autoAlpha also sets visibility:hidden, which
      // removed everything below the fold from the tab order and from screen
      // readers until a physical scroll fired the reveal.
      gsap.from(".events-hero-intro, .events-hero-note, .events-hero-scene", {
        y: 16,
        opacity: 0,
        duration: 0.65,
        ease: "power2.out",
        stagger: 0.12,
        clearProps: "opacity",
      });

      // ── Hero stats count up once they're on stage ───────────────────────
      document.querySelectorAll<HTMLElement>(".events-hero-stats b").forEach((el) => {
        const target = Number(el.textContent ?? "0");
        if (!Number.isFinite(target)) return;
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 0.9,
          ease: "power1.out",
          onUpdate: () => {
            el.textContent = String(Math.round(counter.value));
          },
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      });

      // ── Scroll reveals ──────────────────────────────────────────────────
      // Same autoAlpha caveat: opacity-only keeps controls focusable while
      // they wait for their trigger.
      const reveal = (el: Element, y = 22) =>
        gsap.from(el, {
          y,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      document.querySelectorAll(".events-toolbar, .events-section-label, .events-list-heading, .events-queue-head, .events-filter-panel").forEach((el) => reveal(el));
      gsap.from(".events-spotlight-grid > *", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".events-spotlight-grid", start: "top 88%", once: true },
      });

      // Event rows arrive in batches via the load-more sentinel, so reveal
      // per element and pick up newly appended ones through a MutationObserver.
      const results = document.querySelector(".events-results");
      const revealDynamic = () => {
        document.querySelectorAll(".event-row:not([data-scroll-revealed]), .events-month-item:not([data-scroll-revealed])").forEach((el) => {
          el.setAttribute("data-scroll-revealed", "");
          reveal(el, 18);
        });
        ScrollTrigger.refresh();
      };
      revealDynamic();
      const mutation = new MutationObserver(revealDynamic);
      if (results) mutation.observe(results, { childList: true, subtree: true });

      // Footer gets a soft final beat.
      const footer = document.querySelector(".events-footer");
      if (footer) gsap.from(footer.children, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.08,
        scrollTrigger: { trigger: footer, start: "top 92%", once: true },
      });

      return () => mutation.disconnect();
    });

    // Fonts/layout settle after hydration — re-measure every trigger.
    const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refresh);
      ctx.revert(); // kills triggers + reverts inline styles
      gsap.ticker.remove(raf);
      lenis.destroy();
      document.documentElement.classList.remove("scroll-exp");
      scrollBus.velocity = 0;
      scrollBus.heroProgress = 0;
    };
  }, []);

  return null;
}
