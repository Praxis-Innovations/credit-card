import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";
import { checkRateLimit } from "./rate-limit";

export interface ApiKeyRecord {
  id: string;
  ownerLabel: string;
  tier: "internal" | "standard" | "elevated";
  rateLimitPerMinute: number;
}

/** Matches scripts/generate-catalog-seed.ts SEED_API_KEY (hash seeded in SQL). */
export const SEED_API_KEY =
  "nt_live_northtap_expo_internal_v1_7f3a9c2e8b1d4f06";

const SEED_KEY_HASH = createHash("sha256")
  .update(SEED_API_KEY, "utf8")
  .digest("hex");

const STATIC_KEYS: Record<string, ApiKeyRecord> = {
  [SEED_KEY_HASH]: {
    id: "static-seed-internal",
    ownerLabel: "NorthTap Expo (internal)",
    tier: "internal",
    rateLimitPerMinute: 600,
  },
};

let supabaseAdmin: SupabaseClient | null | undefined;

function getAdminClient(): SupabaseClient | null {
  if (supabaseAdmin !== undefined) return supabaseAdmin;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    supabaseAdmin = null;
    return null;
  }
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function extractRawKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;

  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;
  // JWT wallet auth is out of scope for this pass — only API keys.
  if (token.includes(".")) return null;
  return token;
}

async function lookupKey(keyHash: string): Promise<ApiKeyRecord | null> {
  const client = getAdminClient();
  if (!client) {
    return STATIC_KEYS[keyHash] ?? null;
  }

  const { data, error } = await client
    .from("api_keys")
    .select("id, owner_label, tier, rate_limit_per_minute, active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "internal_error", "Failed to validate API key");
  }
  if (!data || data.active !== true) return null;

  return {
    id: data.id as string,
    ownerLabel: data.owner_label as string,
    tier: data.tier as ApiKeyRecord["tier"],
    rateLimitPerMinute: data.rate_limit_per_minute as number,
  };
}

export interface AuthSuccess {
  apiKey: ApiKeyRecord;
  rateLimitHeaders: Record<string, string>;
}

/**
 * Require a valid API key. Skips nothing except when caller opts out
 * (health uses skipAuth). Applies fixed-window rate limiting per key.
 */
export async function requireApiKey(request: Request): Promise<AuthSuccess> {
  const raw = extractRawKey(request);
  if (!raw) {
    throw new ApiError(
      401,
      "unauthorized",
      "Missing API key. Pass X-Api-Key or Authorization: Bearer <key>.",
    );
  }

  const keyHash = hashApiKey(raw);
  const record = await lookupKey(keyHash);
  if (!record) {
    throw new ApiError(401, "unauthorized", "Invalid API key");
  }

  const rl = checkRateLimit(record.id, record.rateLimitPerMinute);
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAtMs / 1000)),
  };

  if (!rl.allowed) {
    throw new ApiError(
      429,
      "rate_limited",
      `Rate limit exceeded (${rl.limit} requests/minute)`,
    );
  }

  return { apiKey: record, rateLimitHeaders };
}

/** Test helper */
export function resetAuthClient(): void {
  supabaseAdmin = undefined;
}
