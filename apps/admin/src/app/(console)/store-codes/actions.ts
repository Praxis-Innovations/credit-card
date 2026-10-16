"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { chainFromStatement } from "@/lib/mcc-import/research";

export type AddTestPurchaseResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function failure(message: string): AddTestPurchaseResult {
  return { ok: false, message };
}

function networkFromCard(network: string | null): string {
  const n = (network ?? "").toLowerCase();
  if (n === "visa") return "visa";
  if (n === "mastercard") return "mastercard";
  if (n === "amex" || n.includes("american")) return "amex";
  return "all";
}

/**
 * Create a pending test_purchase finding for this chain. Live codes change only
 * after a validator approves it in the review queue (AD6).
 */
export async function addTestPurchaseFinding(input: {
  brandId: string;
  brandName: string;
  cardId: string;
  date: string;
  statementText: string;
  mccShown: string;
  categoryShown: string;
  screenshotFile: string;
}): Promise<AddTestPurchaseResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);

  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return failure("Pick a valid purchase date.");
  }

  const statement = input.statementText.trim();
  if (!statement) return failure("Paste the statement line as shown.");
  if (/\d{12,}/.test(statement)) {
    return failure("Statement line must not contain a card number.");
  }

  const cardId = input.cardId.trim();
  if (!cardId) return failure("Pick the card you used.");

  const { data: card, error: cardError } = await auth.supabase
    .from("cards")
    .select("id, name, network")
    .eq("id", cardId)
    .maybeSingle();
  if (cardError || !card) return failure("That card is not in the catalog.");

  const shown = input.mccShown.trim();
  if (shown && !/^\d{4}$/.test(shown)) {
    return failure("Code, if shown, must be a 4-digit MCC.");
  }
  const categoryShown = input.categoryShown.trim();
  if (!shown && !categoryShown) {
    return failure("Add the code if shown, or the category or points shown.");
  }

  const parsed = chainFromStatement(statement);
  const chain = input.brandName.trim() || parsed.chain;
  const screenshot = input.screenshotFile.trim() || null;

  const proposed = {
    date,
    card: card.name,
    card_id: card.id,
    network: networkFromCard(card.network as string | null),
    statement_text: statement,
    mcc_shown: shown || null,
    category_shown: categoryShown || null,
    screenshot_file: screenshot,
    ...parsed,
    chain,
    merchant_brand_id: input.brandId,
    source_type: "test_purchase",
  };

  const idempotencyKey = `${date}|${card.id}|${statement}`;
  const { data: existing } = await auth.supabase
    .from("merchant_code_findings")
    .select("id, review_status")
    .eq("kind", "test_purchase")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing && existing.review_status !== "pending") {
    return failure("That test purchase was already reviewed. Change the date or statement line.");
  }

  if (existing) {
    const { error } = await auth.supabase
      .from("merchant_code_findings")
      .update({ proposed, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("review_status", "pending");
    if (error) return failure("Could not update the finding. Try again.");
  } else {
    const { error } = await auth.supabase.from("merchant_code_findings").insert({
      kind: "test_purchase",
      idempotency_key: idempotencyKey,
      proposed,
      review_status: "pending",
    });
    if (error) return failure("Could not add the finding. Try again.");
  }

  revalidatePath("/store-codes");
  revalidatePath(`/store-codes/${encodeURIComponent(input.brandId)}`);
  revalidatePath("/review");
  return {
    ok: true,
    message: "Added to the review queue. Nothing changes for users until it is approved.",
  };
}
