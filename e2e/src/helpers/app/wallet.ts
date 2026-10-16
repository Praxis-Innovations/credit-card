import type { SupabaseClient } from "@supabase/supabase-js";
import { E2E_APP_USER_ID } from "./flow";

/** Clear owned cards for the seeded app user (local Supabase only). */
export async function clearAppUserCards(supabase: SupabaseClient, userId = E2E_APP_USER_ID) {
  const { error } = await supabase.from("user_cards").delete().eq("user_id", userId);
  if (error) throw new Error(`clearAppUserCards: ${error.message}`);
}

/** Seed remote wallet rows for the app user before a sign-in merge test. */
export async function seedAppUserCards(
  supabase: SupabaseClient,
  cardIds: string[],
  userId = E2E_APP_USER_ID,
) {
  await clearAppUserCards(supabase, userId);
  if (cardIds.length === 0) return;
  const { error } = await supabase.from("user_cards").insert(
    cardIds.map((card_id) => ({ user_id: userId, card_id })),
  );
  if (error) throw new Error(`seedAppUserCards: ${error.message}`);
}

export async function listAppUserCards(
  supabase: SupabaseClient,
  userId = E2E_APP_USER_ID,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("card_id")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(`listAppUserCards: ${error.message}`);
  return (data ?? []).map((row) => String(row.card_id));
}
