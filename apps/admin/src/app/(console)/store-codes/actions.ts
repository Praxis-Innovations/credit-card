"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { chainFromStatement, networkFromCard } from "@/lib/mcc-import/research";

export type AddTestPurchaseResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type TestPurchaseInput = {
  brandId: string;
  brandName: string;
  cardId: string;
  date: string;
  statementText: string;
  mccShown: string;
  categoryShown: string;
};

function failure(message: string): AddTestPurchaseResult {
  return { ok: false, message };
}

type BrandRow = { id: string; name: string };

type ValidatedPurchase = {
  date: string;
  statement: string;
  shown: string;
  categoryShown: string;
  card: { id: string; name: string; network: string | null };
  chain: string;
  brandId: string;
  proposed: Record<string, unknown>;
  idempotencyKey: string;
};

function validateFields(input: TestPurchaseInput): AddTestPurchaseResult | null {
  if (!input.brandId.trim()) return failure("Pick a store brand.");
  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return failure("Pick a valid purchase date.");
  }
  const statement = input.statementText.trim();
  if (!statement) return failure("Paste the statement line as shown.");
  if (/\d{12,}/.test(statement)) {
    return failure("Statement line must not contain a card number.");
  }
  if (!input.cardId.trim()) return failure("Pick the card you used.");
  const shown = input.mccShown.trim();
  if (shown && !/^\d{4}$/.test(shown)) {
    return failure("Code, if shown, must be a 4-digit MCC.");
  }
  const categoryShown = input.categoryShown.trim();
  if (!shown && !categoryShown) {
    return failure("Add the code if shown, or the category or points shown.");
  }
  return null;
}

async function loadCard(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ id: string; name: string; network: string | null } | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("id, name, network")
    .eq("id", cardId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    name: String(data.name),
    network: (data.network as string | null) ?? null,
  };
}

async function loadBrand(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandRow | null> {
  const { data, error } = await supabase
    .from("merchant_brands")
    .select("id, name")
    .eq("id", brandId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return { id: String(data.id), name: String(data.name) };
}

function brandNameMatches(inputName: string, dbName: string): boolean {
  const typed = inputName.trim();
  if (!typed) return true;
  return typed.toLowerCase() === dbName.trim().toLowerCase();
}

function buildValidated(
  input: TestPurchaseInput,
  card: { id: string; name: string; network: string | null },
  brand: BrandRow,
): ValidatedPurchase {
  const date = input.date.trim();
  const statement = input.statementText.trim();
  const shown = input.mccShown.trim();
  const categoryShown = input.categoryShown.trim();
  const parsed = chainFromStatement(statement);
  // Chain / brand id come from the DB brand row, never the client name alone.
  const chain = brand.name;
  const proposed = {
    date,
    card: card.name,
    card_id: card.id,
    network: networkFromCard(card.network),
    statement_text: statement,
    mcc_shown: shown || null,
    category_shown: categoryShown || null,
    ...parsed,
    chain,
    merchant_brand_id: brand.id,
    source_type: "test_purchase",
  };
  return {
    date,
    statement,
    shown,
    categoryShown,
    card,
    chain,
    brandId: brand.id,
    proposed,
    idempotencyKey: `${date}|${card.id}|${statement}`,
  };
}

async function upsertFinding(
  supabase: SupabaseClient,
  v: ValidatedPurchase,
): Promise<AddTestPurchaseResult | null> {
  const { data: existing } = await supabase
    .from("merchant_code_findings")
    .select("id, review_status")
    .eq("kind", "test_purchase")
    .eq("idempotency_key", v.idempotencyKey)
    .maybeSingle();

  if (existing && existing.review_status !== "pending") {
    return failure("That test purchase was already reviewed. Change the date or statement line.");
  }

  if (existing) {
    const { error } = await supabase
      .from("merchant_code_findings")
      .update({ proposed: v.proposed, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("review_status", "pending");
    if (error) return failure("Could not update the finding. Try again.");
    return null;
  }

  const { error } = await supabase.from("merchant_code_findings").insert({
    kind: "test_purchase",
    idempotency_key: v.idempotencyKey,
    proposed: v.proposed,
    review_status: "pending",
  });
  if (error) return failure("Could not add the finding. Try again.");
  return null;
}

/**
 * Create a pending test_purchase finding for this chain. Live codes change only
 * after a validator approves it in the review queue (AD6).
 */
export async function addTestPurchaseFinding(
  input: TestPurchaseInput,
): Promise<AddTestPurchaseResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);

  const fieldError = validateFields(input);
  if (fieldError) return fieldError;

  const brand = await loadBrand(auth.supabase, input.brandId);
  if (!brand) return failure("That store brand is not in the catalog.");
  if (!brandNameMatches(input.brandName, brand.name)) {
    return failure("Store brand name does not match the catalog.");
  }

  const card = await loadCard(auth.supabase, input.cardId);
  if (!card) return failure("That card is not in the catalog.");

  const validated = buildValidated(input, card, brand);
  const writeError = await upsertFinding(auth.supabase, validated);
  if (writeError) return writeError;

  revalidatePath("/store-codes");
  revalidatePath(`/store-codes/${encodeURIComponent(brand.id)}`);
  revalidatePath("/review");
  return {
    ok: true,
    message: "Added to the review queue. Nothing changes for users until it is approved.",
  };
}
