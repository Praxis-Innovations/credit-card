import { describe, expect, it } from "vitest";
import { contentHash } from "./hash";

describe("contentHash", () => {
  it("is stable across whitespace-only changes and differs when content changes", () => {
    const a = contentHash("Annual fee\n\n$120");
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(contentHash("  Annual fee $120 ")).toBe(a);
    expect(contentHash("Annual fee $150")).not.toBe(a);
  });
});
