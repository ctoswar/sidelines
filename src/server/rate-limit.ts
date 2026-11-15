// In-process fixed-window rate limiter.
//
// The app deploys as one Node process (see src/server/realtime.ts for the
// same constraint), so a module-level Map is the correct scope — no Redis.
// If the app ever runs multi-process, replace this with a shared store.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Clears expired buckets occasionally so the map cannot grow unbounded. */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Consumes one attempt for `key`. Returns false — and does not count — when
 * the caller has exceeded `limit` attempts inside `windowMs`.
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** The caller IP from proxy headers, falling back to the request URL host. */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || new URL(request.url).host || "unknown";
}
