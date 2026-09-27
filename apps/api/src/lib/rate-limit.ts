/** Fixed-window rate limiter (per process). Fine for single-instance / MVP. */

interface WindowState {
  count: number;
  windowStartMs: number;
}

const windows = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}

export function checkRateLimit(
  key: string,
  limitPerMinute: number,
  nowMs = Date.now(),
): RateLimitResult {
  const windowMs = 60_000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const resetAtMs = windowStartMs + windowMs;
  const existing = windows.get(key);

  if (!existing || existing.windowStartMs !== windowStartMs) {
    windows.set(key, { count: 1, windowStartMs });
    return {
      allowed: true,
      limit: limitPerMinute,
      remaining: Math.max(0, limitPerMinute - 1),
      resetAtMs,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limitPerMinute;
  return {
    allowed,
    limit: limitPerMinute,
    remaining: Math.max(0, limitPerMinute - existing.count),
    resetAtMs,
  };
}

/** Test helper — clear in-memory windows. */
export function resetRateLimits(): void {
  windows.clear();
}
