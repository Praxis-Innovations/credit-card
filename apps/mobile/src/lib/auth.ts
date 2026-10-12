import type { SupabaseClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { getSupabaseClient } from "./supabase";

export type GoogleSignInResult =
  | { status: "redirecting" }
  | { status: "signed_in" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export const GOOGLE_NOT_CONFIGURED_MESSAGE =
  "Google sign-in isn't set up for NorthTap yet. Your cards are still saved on this device — try again later.";

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Sign-in isn't available in this build (Supabase is not configured). Your cards are still saved on this device.";

/** Where Supabase sends the browser back after Google. Must be allow-listed in Supabase. */
export function oauthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/result`;
  }
  return Linking.createURL("auth/callback");
}

/**
 * Asks Supabase Auth whether the Google provider is enabled, so we can show a
 * clear message instead of bouncing the user to a raw JSON error page.
 * Returns null when the check itself fails (we then let the redirect try).
 */
export async function isGoogleProviderEnabled(
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  try {
    const res = await fetchImpl(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return body.external?.google === true;
  } catch {
    return null;
  }
}

function paramsFromUrl(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash?.split("?")[1] ?? "";
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

async function completeNativeSession(
  supabase: SupabaseClient,
  url: string,
): Promise<GoogleSignInResult> {
  const params = paramsFromUrl(url);
  const errorDescription = params.get("error_description") ?? params.get("error");
  if (errorDescription) {
    return { status: "error", message: errorDescription };
  }
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error
      ? { status: "error", message: error.message }
      : { status: "signed_in" };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return error
      ? { status: "error", message: error.message }
      : { status: "signed_in" };
  }
  return { status: "error", message: "Google sign-in didn't return a session." };
}

/**
 * Google-only sign-in via Supabase Auth. Web: full-page redirect back to
 * /result. Native: in-app auth session returning to northtap://auth/callback.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { status: "error", message: SUPABASE_NOT_CONFIGURED_MESSAGE };
  }

  const enabled = await isGoogleProviderEnabled();
  if (enabled === false) {
    return { status: "error", message: GOOGLE_NOT_CONFIGURED_MESSAGE };
  }

  const redirectTo = oauthRedirectUrl();

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) return { status: "error", message: error.message };
    return { status: "redirecting" };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return {
      status: "error",
      message: error?.message ?? "Couldn't start Google sign-in.",
    };
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return { status: "cancelled" };
  return completeNativeSession(supabase, result.url);
}

/** Remote ids first (their order), then local-only ids. */
export function walletUnion(remote: string[], local: string[]): string[] {
  const seen = new Set(remote);
  return [...remote, ...local.filter((id) => !seen.has(id) && seen.add(id))];
}

/**
 * On sign-in, copy guest cards into user_cards (skipping ones already there)
 * and return the combined wallet.
 */
export async function mergeGuestWallet(
  supabase: SupabaseClient,
  userId: string,
  guestIds: string[],
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("card_id")
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  const remote = (data ?? []).map((row) => String(row.card_id));
  const merged = walletUnion(remote, guestIds);
  const missing = merged.slice(remote.length);
  if (missing.length > 0) {
    const { error: upsertError } = await supabase
      .from("user_cards")
      .upsert(
        missing.map((card_id) => ({ user_id: userId, card_id })),
        { onConflict: "user_id,card_id", ignoreDuplicates: true },
      );
    if (upsertError) throw new Error(upsertError.message);
  }
  return merged;
}
