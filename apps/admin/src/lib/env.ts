export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see apps/admin/.env.example).",
    );
  }
  return { url, publishableKey };
}

/** The console's own origin, e.g. http://localhost:3100. */
export function adminOrigin(): string {
  const raw = process.env.ADMIN_ORIGIN;
  if (!raw) {
    throw new Error("Set ADMIN_ORIGIN (see apps/admin/.env.example).");
  }
  return new URL(raw).origin;
}
