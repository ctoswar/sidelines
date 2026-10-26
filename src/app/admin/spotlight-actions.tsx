"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEventFeatured } from "@/lib/admin";

/**
 * Add to / remove from Spotlight for one published event.
 *
 * The only control that writes `events.featured`, and it exists inside the
 * admin layout's server gate — so the caller is an admin by the time this
 * runs. The route re-checks anyway; this button is a convenience, not a gate.
 */
export function SpotlightActions({ slug, featured }: { slug: string; featured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const flip = async () => {
    setBusy(true);
    setError("");
    try {
      await setEventFeatured(slug, !featured);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the Spotlight.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <button className="btn" onClick={flip} disabled={busy}>
        {busy ? "Saving…" : featured ? "Remove from Spotlight" : "Add to Spotlight"}
      </button>
      {error && <span role="alert" className="text-sm font-medium text-flag">{error}</span>}
    </span>
  );
}
