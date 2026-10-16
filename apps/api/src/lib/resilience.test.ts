import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStaticApiKeys,
  registerStaticApiKey,
  resetAuthClient,
} from "./auth";
import { resetCatalogClient } from "./catalog";
import { resetRateLimits } from "./rate-limit";

type Row = Record<string, unknown>;

/** Controllable stub — fail auth, fail catalog, or succeed. */
const stub = vi.hoisted(() => ({
  mode: "ok" as "ok" | "auth_down" | "catalog_down",
  apiKeyRow: null as Row | null,
}));

vi.mock("@supabase/supabase-js", () => {
  function result(table: string): { data: unknown; error: unknown } {
    if (stub.mode === "auth_down" && table === "api_keys") {
      return { data: null, error: { message: "connection refused" } };
    }
    if (stub.mode === "catalog_down" && table !== "api_keys") {
      return { data: null, error: { message: "connection refused" } };
    }
    if (table === "api_keys") {
      return { data: stub.apiKeyRow, error: null };
    }
    return { data: [], error: null };
  }

  return {
    createClient: () => ({
      from(table: string) {
        let filtered: Row[] | null = null;
        const builder = {
          select: () => builder,
          order: () => builder,
          eq(column: string, value: unknown) {
            if (table === "api_keys" && stub.apiKeyRow) {
              filtered =
                stub.apiKeyRow[column] === value ? [stub.apiKeyRow] : [];
            }
            return builder;
          },
          maybeSingle: () => {
            const failed = result(table);
            if (failed.error) return Promise.resolve(failed);
            const rows =
              filtered ??
              (stub.apiKeyRow && table === "api_keys" ? [stub.apiKeyRow] : []);
            return Promise.resolve({ data: rows[0] ?? null, error: null });
          },
          then: (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => Promise.resolve(result(table)).then(resolve, reject),
        };
        return builder;
      },
    }),
  };
});

import { hashApiKey } from "./auth";
import { GET as getCards } from "../app/v1/cards/route";

const TEST_API_KEY = "test-api-key-not-a-production-secret";

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:8787${path}`, init);
}

function authHeaders(key = TEST_API_KEY): HeadersInit {
  return { "X-Api-Key": key };
}

beforeEach(() => {
  stub.mode = "ok";
  stub.apiKeyRow = null;
  resetRateLimits();
  clearStaticApiKeys();
  resetCatalogClient();
  resetAuthClient();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NORTHTAP_CATALOG_SOURCE = "static";
});

afterEach(() => {
  resetCatalogClient();
  resetAuthClient();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NORTHTAP_CATALOG_SOURCE = "static";
});

describe("rate limiting", () => {
  it("returns 429 when the per-key limit is exceeded", async () => {
    registerStaticApiKey(TEST_API_KEY, {
      id: "rl-test",
      rateLimitPerMinute: 2,
    });

    const first = await getCards(
      req("/v1/cards?limit=1", { headers: authHeaders() }),
    );
    const second = await getCards(
      req("/v1/cards?limit=1", { headers: authHeaders() }),
    );
    const third = await getCards(
      req("/v1/cards?limit=1", { headers: authHeaders() }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    const body = (await third.json()) as { error: { code: string } };
    expect(body.error.code).toBe("rate_limited");
    expect(first.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("Supabase down (503)", () => {
  function enableSupabaseStub(): void {
    process.env.NORTHTAP_CATALOG_SOURCE = "supabase";
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role-not-a-secret";
    stub.apiKeyRow = {
      id: "k1",
      key_hash: hashApiKey(TEST_API_KEY),
      owner_label: "resilience test",
      tier: "internal",
      rate_limit_per_minute: 600,
      active: true,
    };
    resetCatalogClient();
    resetAuthClient();
  }

  it("returns 503 when API key lookup cannot reach Supabase", async () => {
    enableSupabaseStub();
    stub.mode = "auth_down";

    const res = await getCards(
      req("/v1/cards?limit=1", { headers: authHeaders() }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("service_unavailable");
  });

  it("returns 503 when the catalog cannot reach Supabase", async () => {
    enableSupabaseStub();
    stub.mode = "catalog_down";

    const res = await getCards(
      req("/v1/cards?limit=1", { headers: authHeaders() }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("service_unavailable");
  });
});
