import { LoadingDots } from "./loading-dots";

/**
 * The single branded loading screen for the whole app. Every `loading.tsx`
 * renders this rather than hand-rolling markup, so a fallback looks identical
 * wherever it appears and the look lives in exactly one place.
 *
 * It fills its *container* with `min-h-screen` instead of using `position: fixed`.
 * Next.js nests a segment's `loading.tsx` inside that segment's own layout, so
 * at the root this covers the viewport, and inside the player/organizer layout
 * it fills the content column while the sidebar shell stays mounted and
 * interactive. A `fixed` overlay would be wrong in one of those two cases.
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-score text-5xl font-bold leading-none">Sidelines<span>.</span></p>
        <p className="mt-4 text-sm text-muted">
          <LoadingDots label={label} />
        </p>
      </div>
    </div>
  );
}
