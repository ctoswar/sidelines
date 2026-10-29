// Shared mutable channel between the scroll layer (Lenis + ScrollTrigger,
// see ScrollExperience) and the Three.js hero scene. The scroll layer writes,
// the scene reads each frame — a tiny pub-sub without React re-renders.
// Client-side only; values are meaningless during SSR.
export const scrollBus = {
  /** Lenis velocity in px/frame-ish; spikes while flicking, settles to 0. */
  velocity: 0,
  /** 0 → hero fully in view, 1 → hero fully scrolled past. */
  heroProgress: 0,
  /** Paddle strikes since mount, seeded so the scorebug starts mid-rally. */
  rallyCount: 41,
};
