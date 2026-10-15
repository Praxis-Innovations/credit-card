import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  const windowMs = 60_000;
  // Mid-window timestamp so floor(now/window)*window is deterministic.
  const nowInWindow = 1_700_000_030_000;
  const windowStart = Math.floor(nowInWindow / windowMs) * windowMs;
  const resetAtMs = windowStart + windowMs;

  it("allows the first request and decrements remaining", () => {
    const first = checkRateLimit("k1", 3, nowInWindow);
    expect(first).toEqual({
      allowed: true,
      limit: 3,
      remaining: 2,
      resetAtMs,
    });
  });

  it("allows up to the limit then rejects", () => {
    expect(checkRateLimit("k1", 2, nowInWindow).allowed).toBe(true);
    expect(checkRateLimit("k1", 2, nowInWindow).allowed).toBe(true);
    const blocked = checkRateLimit("k1", 2, nowInWindow);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(2);
  });

  it("isolates counters per key", () => {
    checkRateLimit("a", 1, nowInWindow);
    expect(checkRateLimit("a", 1, nowInWindow).allowed).toBe(false);
    expect(checkRateLimit("b", 1, nowInWindow).allowed).toBe(true);
  });

  it("resets when the fixed window rolls", () => {
    expect(checkRateLimit("k1", 1, nowInWindow).allowed).toBe(true);
    expect(checkRateLimit("k1", 1, nowInWindow).allowed).toBe(false);
    const nextWindowNow = resetAtMs + 1;
    const rolled = checkRateLimit("k1", 1, nextWindowNow);
    expect(rolled.allowed).toBe(true);
    expect(rolled.resetAtMs).toBe(resetAtMs + windowMs);
  });
});
