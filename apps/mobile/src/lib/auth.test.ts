import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-linking", () => ({ createURL: (path: string) => `northtap://${path}` }));
vi.mock("expo-web-browser", () => ({ openAuthSessionAsync: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseClient: vi.fn(() => null) }));

import { isGoogleProviderEnabled, mergeGuestWallet, walletUnion } from "./auth";

describe("walletUnion", () => {
  it("keeps remote order and appends local-only ids once", () => {
    expect(walletUnion(["a", "b"], ["b", "c", "c", "d"])).toEqual(["a", "b", "c", "d"]);
    expect(walletUnion([], ["x"])).toEqual(["x"]);
  });
});

function fakeSupabase(remote: string[], upsertError: string | null = null) {
  const upsert = vi.fn(async () => ({ error: upsertError ? { message: upsertError } : null }));
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        order: async () => ({ data: remote.map((card_id) => ({ card_id })), error: null }),
      }),
      upsert,
    })),
  } as unknown as SupabaseClient;
  return { client, upsert };
}

describe("mergeGuestWallet", () => {
  it("inserts only guest cards the account doesn't have", async () => {
    const { client, upsert } = fakeSupabase(["cibc-costco-mc"]);
    const merged = await mergeGuestWallet(client, "user-1", ["scotia-gold-amex", "cibc-costco-mc"]);
    expect(merged).toEqual(["cibc-costco-mc", "scotia-gold-amex"]);
    expect(upsert).toHaveBeenCalledWith([{ user_id: "user-1", card_id: "scotia-gold-amex" }], {
      onConflict: "user_id,card_id",
      ignoreDuplicates: true,
    });
  });

  it("skips the write when nothing is new", async () => {
    const { client, upsert } = fakeSupabase(["a"]);
    expect(await mergeGuestWallet(client, "user-1", ["a"])).toEqual(["a"]);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("surfaces write errors", async () => {
    const { client } = fakeSupabase([], "permission denied");
    await expect(mergeGuestWallet(client, "user-1", ["a"])).rejects.toThrow("permission denied");
  });
});

describe("isGoogleProviderEnabled", () => {
  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://proj.supabase.co/");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const respond = (body: unknown, ok = true) =>
    vi.fn(async () => ({ ok, json: async () => body }) as Response);

  it("reads external.google from Auth settings", async () => {
    const fetchImpl = respond({ external: { google: true, email: true } });
    expect(await isGoogleProviderEnabled(fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("https://proj.supabase.co/auth/v1/settings", {
      headers: { apikey: "anon" },
    });
    expect(await isGoogleProviderEnabled(respond({ external: { google: false } }))).toBe(false);
  });

  it("returns null when the check itself fails", async () => {
    expect(await isGoogleProviderEnabled(respond({}, false))).toBeNull();
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await isGoogleProviderEnabled(failing)).toBeNull();
  });

  it("is false when Supabase isn't configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "");
    expect(await isGoogleProviderEnabled(respond({ external: { google: true } }))).toBe(false);
  });
});
