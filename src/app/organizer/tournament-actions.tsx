"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTournamentStatus } from "@/lib/tournaments";

/**
 * Make live / save as draft for one dashboard row. Exactly one tournament is
 * live at a time — the server returns any other live one to draft — and the
 * dashboard re-reads the list after the write (the page is a server render).
 */
export function TournamentActions({ id, status }: { id: string; status: "Live" | "Draft" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const flip = async () => {
    setBusy(true);
    setError("");
    try {
      await setTournamentStatus(id, status === "Live" ? "draft" : "live");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the tournament.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-2">
      <button className="btn" onClick={flip} disabled={busy}>
        {busy ? "Saving…" : status === "Live" ? "Save as draft" : "Make live"}
      </button>
      {error && <span role="alert" className="text-sm font-medium text-flag">{error}</span>}
    </span>
  );
}
