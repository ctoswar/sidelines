// In-process realtime bus.
//
// The app runs as one Node process (Next standalone, single container on the
// Pi), so mutation routes and the SSE stream handler share this bus directly.
// That is the whole transport for v1: a route publishes a topic after a
// successful write, `/api/stream` forwards it to connected browsers, and any
// client whose EventSource is unavailable falls back to polling the same JSON
// endpoints. No LISTEN/NOTIFY, no Redis — those arrive if the app ever runs
// more than one process.
//
// The globalThis cache keeps dev hot-reload from spawning a second bus per
// reload (same trick as server/db.ts).

import type { RealtimeTopic } from "@/lib/realtime";

type Listener = (topic: RealtimeTopic) => void;

type Bus = Set<Listener>;

function createBus(): Bus {
  return new Set();
}

const globalForBus = globalThis as unknown as { __sidelinesBus?: Bus };

const bus: Bus = globalForBus.__sidelinesBus ?? createBus();

if (process.env.NODE_ENV !== "production") globalForBus.__sidelinesBus = bus;

/** Registers a listener; returns the unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  bus.add(listener);
  return () => bus.delete(listener);
}

/** Publishes a topic to every connected listener. Failures are swallowed. */
export function publish(topic: RealtimeTopic): void {
  for (const listener of bus) {
    try {
      listener(topic);
    } catch {
      /* a broken subscriber must not fail the write that published */
    }
  }
}
