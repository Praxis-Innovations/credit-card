import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadReviewQueue, QUEUE_DIFF_KINDS, REVIEW_PAGE_SIZE } from "./queue";

function recordingClient() {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "returns"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("loadReviewQueue", () => {
  it("lists only pending new, changed and possibly discontinued findings, newest first", () => {
    const { client, calls } = recordingClient();
    loadReviewQueue(client);
    expect(calls).toContainEqual(["from", "card_findings"]);
    expect(calls).toContainEqual(["eq", "review_status", "pending"]);
    expect(calls).toContainEqual(["in", "diff_kind", ["new", "changed", "possibly_discontinued"]]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(calls).toContainEqual(["limit", REVIEW_PAGE_SIZE]);
  });

  it("never includes unchanged cards", () => {
    expect(QUEUE_DIFF_KINDS).not.toContain("unchanged");
  });
});
