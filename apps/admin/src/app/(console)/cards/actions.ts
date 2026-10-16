"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";

export type RetireResult = { ok: true; message: string } | { ok: false; message: string };

function failure(message: string): RetireResult {
  return { ok: false, message };
}

/**
 * Retire a live catalog card (status → rejected). Admins only; audited in
 * admin_audit as card.retire. Rejected cards stay visible in the console but
 * drop out of the public API.
 */
export async function retireCard(cardId: string): Promise<RetireResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);

  const id = cardId.trim();
  if (!id || id.length > 120) return failure("That card no longer exists.");

  const { data, error } = await auth.supabase.rpc("retire_card", { p_card_id: id });
  if (error) return failure("Could not retire this card. Try again.");
  if (data == null) return failure("That card no longer exists.");

  const already = typeof data === "object" && data !== null && "already" in data && data.already === true;
  revalidatePath("/cards");
  revalidatePath(`/cards/${encodeURIComponent(id)}`);
  return {
    ok: true,
    message: already ? "This card is already retired." : "Card retired. It is no longer served by the API.",
  };
}
