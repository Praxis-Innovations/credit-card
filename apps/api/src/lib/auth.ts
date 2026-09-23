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

/**
 * In-memory key hashes for static-catalog / unit-test mode (no Supabase).
 * Populated from NORTHTAP_STATIC_API_KEY at runtime, or via registerStaticApiKey
 * in tests — never hardcode plaintext keys in source.
 */
const STATIC_KEYS: Record<string, ApiKeyRecord> = {};

function registerFromEnv(): void {
  const raw = process.env.NORTHTAP_STATIC_API_KEY?.trim();
  if (!raw) return;
  STATIC_KEYS[hashApiKey(raw)] = {
    id: "env-static-internal",
    ownerLabel: "NorthTap (NORTHTAP_STATIC_API_KEY)",
    tier: "internal",
    rateLimitPerMinute: 600,
  };
}
registerFromEnv();

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

/** Test-only: register a throwaway key without committing secrets. */
export function registerStaticApiKey(
  plaintext: string,
  record?: Partial<ApiKeyRecord>,
): ApiKeyRecord {
  const entry: ApiKeyRecord = {
    id: record?.id ?? `test-${hashApiKey(plaintext).slice(0, 8)}`,
    ownerLabel: record?.ownerLabel ?? "test",
    tier: record?.tier ?? "internal",
    rateLimitPerMinute: record?.rateLimitPerMinute ?? 600,
  };
  STATIC_KEYS[hashApiKey(plaintext)] = entry;
  return entry;
}

/** Test-only */
export function clearStaticApiKeys(): void {
  for (const k of Object.keys(STATIC_KEYS)) delete STATIC_KEYS[k];
  registerFromEnv();
}

function extractRawKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;

  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;
  // JWT wallet auth is intentionally unsupported — api keys only.
  // Tokens that look like JWTs (contain '.') are rejected as invalid keys.
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
 * Require a valid API key. Health is the only unauthenticated route.
 *
 * Intentionally API-key only — never treat a Supabase JWT as identity and never
 * look up `user_cards`. Callers pass opaque ownedCardIds for recommendations.
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
