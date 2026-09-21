import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { ssrSafeStorage } from "./ssr-safe-storage";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  // Static process.env.EXPO_PUBLIC_* access is required so Metro inlines values at build time.
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Supabase client for Expo (iOS / Android / Web).
 * Uses AsyncStorage (via SSR-safe wrapper) for session persistence instead of
 * browser cookies — works across native and Expo web.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (client) return client;

  client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: ssrSafeStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Deep-link / magic-link session detection is web-oriented.
        detectSessionInUrl: Platform.OS === "web",
      },
    },
  );
  return client;
}
