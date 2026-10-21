"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTournamentFeatured, setTournamentStatus } from "@/lib/tournaments";

/**
 * Make live / save as draft for one dashboard row, plus the homepage Spotlight
 * toggle once the tournament has a published event.
 *
 * Exactly one tournament is live at a time — the server returns any other live
 * one to draft — and the dashboard re-reads the list after the write (the page
 * is a server render).
 */
export function TournamentActions({
  id,
  status,
  featured,
  hasEvent,
}: {
  id: string;
  status: "Live" | "Draft";
  featured: boolean;
  hasEvent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "status" | "featured">("");
  const [error, setError] = useState("");

  const run = async (task: "status" | "featured", action: () => Promise<unknown>) => {
    setBusy(task);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the tournament.");
    } finally {
      setBusy("");
    }
  };

  const flipStatus = () =>
    run("status", () => setTournamentStatus(id, status === "Live" ? "draft" : "live"));
  const flipFeatured = () => run("featured", () => setTournamentFeatured(id, !featured));

  return (
    <span className="flex items-center gap-2">
      <button className="btn" onClick={flipStatus} disabled={busy !== ""}>
        {busy === "status" ? "Saving…" : status === "Live" ? "Save as draft" : "Make live"}
      </button>
      {hasEvent && (
        <button className="btn" onClick={flipFeatured} disabled={busy !== ""}>
          {busy === "featured"
            ? "Saving…"
            : featured
              ? "Remove from Spotlight"
              : "Add to Spotlight"}
        </button>
      )}
      {error && <span role="alert" className="text-sm font-medium text-flag">{error}</span>}
    </span>
  );
}
