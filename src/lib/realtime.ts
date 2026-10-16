// Client realtime subscription.
//
// One SSE stream per subscription: the browser opens `/api/stream` and the
// server pushes a data-free `event: <topic>` frame whenever one of the
// mutation routes publishes. The client then refetches through the normal
// JSON endpoints — the stream never carries data, so it can stay public and
// every authorization rule keeps living in the API it already lives in.
//
// When streaming is unavailable (EventSource unsupported, or the connection
// closes for good — a proxy that buffers, a server that answers non-SSE), the
// subscription silently degrades to polling `onChange` on an interval. That is
// the fallback: the same refetch the SSE frame would have triggered, just on a
// timer instead of instantly.

import { useEffect, useRef } from "react";

/** Topics the server publishes; each maps to a refetch the client already knows. */
export type RealtimeTopic = "results" | "announcements" | "registrations" | "crew" | "schedule";

/** The EventSource surface this module uses — injectable for tests. */
type EventSourceLike = {
  readyState: number;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
};

type EventSourceCtor = new (url: string) => EventSourceLike;

const EVENT_SOURCE_CLOSED = 2;

export type SubscribeOptions = {
  /** Polling interval once streaming is unavailable. Default 15s. */
  pollMs?: number;
  /** Test seam: replace (or pass null to disable) the EventSource constructor. */
  EventSourceImpl?: EventSourceCtor | null;
};

/**
 * Subscribes to realtime topics over SSE with a polling fallback.
 * Returns the unsubscribe function.
 */
export function subscribeLive(
  topics: readonly RealtimeTopic[],
  onChange: (topic: RealtimeTopic) => void,
  options: SubscribeOptions = {},
): () => void {
  const { pollMs = 15_000 } = options;
  const Impl =
    options.EventSourceImpl === undefined
      ? typeof EventSource !== "undefined"
        ? EventSource
        : null
      : options.EventSourceImpl;

  let stopped = false;
  let polling = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let source: EventSourceLike | null = null;

  const stopPolling = () => {
    if (pollTimer !== null) clearInterval(pollTimer);
    pollTimer = null;
    polling = false;
  };

  const startPolling = () => {
    if (polling || stopped) return;
    polling = true;
    // Poll immediately, then on the interval: a degraded stream should not
    // wait a full period before the first refresh.
    for (const topic of topics) onChange(topic);
    pollTimer = setInterval(() => {
      for (const topic of topics) onChange(topic);
    }, pollMs);
  };

  if (!Impl) {
    startPolling();
    return () => {
      stopped = true;
      stopPolling();
    };
  }

  source = new Impl("/api/stream");
  for (const topic of topics) {
    source.addEventListener(topic, () => {
      if (!stopped) onChange(topic);
    });
  }
  source.onerror = () => {
    // EventSource retries transient drops on its own (readyState CONNECTING);
    // only a fatal close demotes the subscription to polling.
    if (stopped) return;
    if (!source || source.readyState === EVENT_SOURCE_CLOSED) {
      source?.close();
      source = null;
      startPolling();
    }
  };

  return () => {
    stopped = true;
    source?.close();
    source = null;
    stopPolling();
  };
}

/**
 * React wrapper: re-subscribes when the topic list changes and keeps the
 * latest callback without resubscribing.
 */
export function useLiveSubscription(
  topics: readonly RealtimeTopic[],
  onChange: (topic: RealtimeTopic) => void,
): void {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });

  const key = topics.join(",");
  useEffect(
    () =>
      subscribeLive(key.split(",") as RealtimeTopic[], (topic) => handler.current(topic)),
    [key],
  );
}
