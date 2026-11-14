"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom cursor: a lime outline arrow that tracks the pointer almost
 * instantly, plus a pill label that trails behind on a slight lerp.
 *
 * The label is context-aware through a `data-cursor="Some text"` attribute on
 * any element (event delegation on document, so dynamically rendered content
 * works too). Elements can add `data-cursor-theme="dark"` to flip the pill to
 * ink-on-lime when it would otherwise sit on the site's lime surfaces.
 *
 * Fine pointers only — the component renders nothing until
 * `(hover: hover) and (pointer: fine)` matches, and the native cursor is
 * hidden by a globals.css rule gated on the `custom-cursor` class this
 * component puts on <html>. Over text fields the native caret pointer comes
 * back (`cursor-native` class) and the custom layer fades out. The layer is
 * `aria-hidden`, `pointer-events: none` and fixed-positioned, so it can never
 * intercept input or shift layout. Everything positions through
 * `translate3d` inside one rAF loop; listeners and the frame are torn down on
 * unmount.
 */

/** Near-instant follow for the arrow (per-frame lerp factor). */
const ARROW_EASE = 0.9;
/** Trailing spring for the label pill (per-frame lerp factor). */
const LABEL_EASE = 0.18;
/** The arrow SVG's tip sits at (3,3) of its 24px box. */
const TIP_OFFSET = 3;
/** Pill anchor, relative to the pointer. */
const LABEL_OFFSET_X = 14;
const LABEL_OFFSET_Y = 18;

/** Fields where typing needs the real text cursor back. */
const TEXT_FIELD_SELECTOR = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"])',
  "textarea",
  '[contenteditable="true"]',
].join(", ");

/** Things the arrow enlarges over when they carry no label. */
const INTERACTIVE_SELECTOR = 'a, button, [role="button"], label, summary, input, select, textarea';

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const arrowIconRef = useRef<SVGSVGElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const pillInnerRef = useRef<HTMLDivElement>(null);
  const pillTextRef = useRef<HTMLSpanElement>(null);

  // SSR-safe fine-pointer check (same pattern as usePrefersReducedMotion):
  // render nothing first so server and client HTML match, flip after mount,
  // and re-evaluate if the pointer situation changes (e.g. a mouse is
  // connected to a touch device).
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setEnabled(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setEnabled(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const layer = layerRef.current;
    const arrow = arrowRef.current;
    const arrowIcon = arrowIconRef.current;
    const pill = pillRef.current;
    const pillInner = pillInnerRef.current;
    const pillText = pillTextRef.current;
    const root = document.documentElement;
    if (!layer || !arrow || !arrowIcon || !pill || !pillInner || !pillText) return;

    root.classList.add("custom-cursor");

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedMq.matches;
    const onReducedChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
    };
    reducedMq.addEventListener("change", onReducedChange);

    const mouse = { x: 0, y: 0 };
    const arrowPos = { x: 0, y: 0, px: -1, py: -1 }; // px/py = last written frame
    const pillPos = { x: 0, y: 0, px: -1, py: -1 };
    let seen = false; // first mousemove happened — nothing renders at (0,0) before it
    let leftWindow = true; // starts "left" so the layer stays hidden until entry
    let overField = false; // pointer rests on a text field
    let pillOn = false; // a label is currently displayed
    let pressed = false; // mouse button held
    let hoverScale = 1; // hover enlargement target
    let raf = 0;

    const setVisible = () => {
      layer.dataset.visible = seen && !leftWindow && !overField ? "true" : "false";
    };

    const applyScale = () => {
      const transform = `scale(${pressed ? 0.9 : hoverScale})`;
      if (arrowIcon.style.transform !== transform) arrowIcon.style.transform = transform;
    };

    // A fresh pill appearance starts at the pointer instead of flying in from
    // wherever the previous label was.
    const snapPill = () => {
      pillPos.x = mouse.x + LABEL_OFFSET_X;
      pillPos.y = mouse.y + LABEL_OFFSET_Y;
    };

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (!seen) {
        seen = true;
        arrowPos.x = mouse.x;
        arrowPos.y = mouse.y;
        snapPill();
      }
      // Re-entering the window by moving is covered even if no mouseover fires.
      if (leftWindow) leftWindow = false;
      setVisible();
    };

    // Event delegation: recompute the whole cursor state from whatever element
    // is under the pointer. closest() makes nested/dynamic markup work.
    const onOver = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (leftWindow) leftWindow = false;

      const isField = target.closest(TEXT_FIELD_SELECTOR) !== null;
      if (isField !== overField) {
        overField = isField;
        root.classList.toggle("cursor-native", isField);
      }
      if (overField) {
        // Native caret pointer territory: fade the custom layer out.
        setVisible();
        return;
      }

      const labeled = target.closest("[data-cursor]");
      if (labeled) {
        const text = labeled.getAttribute("data-cursor") ?? "";
        if (pillText.textContent !== text) pillText.textContent = text;
        layer.dataset.theme = labeled.closest('[data-cursor-theme="dark"]') ? "dark" : "lime";
        if (!pillOn) snapPill();
        pillOn = true;
        pillInner.dataset.show = "true";
      } else if (pillOn) {
        pillOn = false;
        pillInner.dataset.show = "false";
      }

      // Enlarge over interactive elements that carry no label of their own.
      hoverScale = labeled ? 1 : target.closest(INTERACTIVE_SELECTOR) ? 1.15 : 1;
      if (!pressed) applyScale();
      setVisible();
    };

    // Leaving the window: mouseout to nothing, or mouseleave off the root.
    const onOut = (event: MouseEvent) => {
      if (!event.relatedTarget) {
        leftWindow = true;
        setVisible();
      }
    };
    const onLeave = () => {
      leftWindow = true;
      setVisible();
    };
    const onBlur = () => {
      // Alt-tab: also drop a held button so the arrow can't stay squashed.
      leftWindow = true;
      pressed = false;
      applyScale();
      setVisible();
    };
    const onDown = () => {
      pressed = true;
      applyScale();
    };
    const onUp = () => {
      pressed = false;
      applyScale();
    };

    // Kill the asymptotic float tail so idle frames stop writing styles.
    const follow = (from: number, to: number, ease: number) => {
      const next = from + (to - from) * ease;
      return Math.abs(to - next) < 0.05 ? to : next;
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!seen) return;
      const arrowEase = reduced ? 1 : ARROW_EASE;
      const labelEase = reduced ? 1 : LABEL_EASE;
      arrowPos.x = follow(arrowPos.x, mouse.x, arrowEase);
      arrowPos.y = follow(arrowPos.y, mouse.y, arrowEase);
      pillPos.x = follow(pillPos.x, mouse.x + LABEL_OFFSET_X, labelEase);
      pillPos.y = follow(pillPos.y, mouse.y + LABEL_OFFSET_Y, labelEase);
      if (arrowPos.x !== arrowPos.px || arrowPos.y !== arrowPos.py) {
        arrowPos.px = arrowPos.x;
        arrowPos.py = arrowPos.y;
        arrow.style.transform = `translate3d(${(arrowPos.x - TIP_OFFSET).toFixed(2)}px, ${(arrowPos.y - TIP_OFFSET).toFixed(2)}px, 0)`;
      }
      if (pillPos.x !== pillPos.px || pillPos.y !== pillPos.py) {
        pillPos.px = pillPos.x;
        pillPos.py = pillPos.y;
        pill.style.transform = `translate3d(${pillPos.x.toFixed(2)}px, ${pillPos.y.toFixed(2)}px, 0)`;
      }
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onBlur);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onBlur);
      reducedMq.removeEventListener("change", onReducedChange);
      root.classList.remove("custom-cursor", "cursor-native");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={layerRef} className="custom-cursor-layer" data-visible="false" data-theme="lime" aria-hidden="true">
      <div ref={arrowRef} className="custom-cursor-arrow">
        <svg ref={arrowIconRef} width="24" height="24" viewBox="0 0 24 24" fill="none">
          {/* Stroke color comes from CSS so it can follow the theme vars. */}
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div ref={pillRef} className="custom-cursor-pill">
        <div ref={pillInnerRef} className="custom-cursor-pill-inner" data-show="false">
          <span ref={pillTextRef} />
        </div>
      </div>
    </div>
  );
}
