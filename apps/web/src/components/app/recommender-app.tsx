"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  CATEGORY_LABELS,
  type Category,
} from "@northtap/core";
import { AppResults } from "@/components/app/app-results";
import { AppShell } from "@/components/app/app-shell";
import { AppWallet } from "@/components/app/app-wallet";
import { AuthPanel } from "@/components/app/auth-panel";
import { CategoryPicker } from "@/components/app/category-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ApiErrorBody,
  RecommendationItem,
  RecommendationResponse,
} from "@/lib/api-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "northtap.ownedCardIds";

export function RecommenderApp() {
  const [user, setUser] = useState<User | null>(null);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [amount, setAmount] = useState("87.42");
  const [merchant, setMerchant] = useState("Loblaws");
  const [category, setCategory] = useState<Category>("groceries");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [lastPurchase, setLastPurchase] = useState<
    RecommendationResponse["purchase"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  const onUserChange = useCallback((next: User | null) => {
    setUser(next);
  }, []);

  // Load guest wallet from localStorage once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setOwnedIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist guest wallet when signed out.
  useEffect(() => {
    if (!hydrated || user) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ownedIds));
  }, [ownedIds, hydrated, user]);

  // When signed in, load wallet from Supabase user_cards.
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    setWalletBusy(true);
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("user_cards")
        .select("card_id")
        .order("added_at", { ascending: true });
      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
      } else {
        setOwnedIds((data ?? []).map((row) => row.card_id as string));
      }
      setWalletBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggleCard(id: string) {
    const nextHas = !ownedIds.includes(id);
    const previous = ownedIds;
    const next = nextHas
      ? [...ownedIds, id]
      : ownedIds.filter((x) => x !== id);
    setOwnedIds(next);

    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    if (nextHas) {
      const { error: insertError } = await supabase
        .from("user_cards")
        .insert({ user_id: user.id, card_id: id });
      if (insertError && insertError.code !== "23505") {
        setOwnedIds(previous);
        setError(insertError.message);
      }
    } else {
      const { error: deleteError } = await supabase
        .from("user_cards")
        .delete()
        .eq("card_id", id);
      if (deleteError) {
        setOwnedIds(previous);
        setError(deleteError.message);
      }
    }
  }

  async function clearWallet() {
    const previous = ownedIds;
    setOwnedIds([]);
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .neq("card_id", "");
    if (deleteError) {
      setOwnedIds(previous);
      setError(deleteError.message);
    }
  }

  async function runRecommend(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setRecommendations([]);
    setLastPurchase(null);

    const amountCad = Number(amount);
    if (!(amountCad > 0)) {
      setError("Enter a purchase amount greater than 0.");
      setBusy(false);
      return;
    }
    if (ownedIds.length === 0) {
      setError("Select at least one card in your wallet.");
      setBusy(false);
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const supabase = getSupabaseBrowserClient();
      if (supabase && user) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/v1/recommendations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amountCad,
          category,
          merchant: merchant.trim() || undefined,
          ownedCardIds: ownedIds,
          limit: 10,
        }),
      });

      const payload = (await res.json()) as
        | RecommendationResponse
        | ApiErrorBody;

      if (!res.ok) {
        const err = payload as ApiErrorBody;
        setError(err.error?.message ?? `Request failed (${res.status})`);
        return;
      }

      const ok = payload as RecommendationResponse;
      setRecommendations(ok.recommendations);
      setLastPurchase(ok.purchase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation failed");
    } finally {
      setBusy(false);
    }
  }

  const syncHint = user
    ? walletBusy
      ? "syncing…"
      : "synced to Supabase"
    : "saved in this browser";

  const emptyHint =
    ownedIds.length === 0
      ? "Add cards to your wallet, then describe a purchase."
      : "Fill in the purchase and hit Recommend.";

  return (
    <AppShell>
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Functional app
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Which card for this purchase?
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Enter an amount and merchant/category. We rank your wallet with clear
          reasoning — powered by the shared NorthTap engine and Supabase-backed
          ownership when you sign in.
        </p>
      </div>

      <div className="mb-6">
        <AuthPanel user={user} onUserChange={onUserChange} />
      </div>

      {error && (
        <div
          className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
        <AppWallet
          ownedIds={ownedIds}
          onToggle={toggleCard}
          onClear={clearWallet}
          syncHint={syncHint}
        />

        <div className="flex flex-col gap-5">
          <form
            onSubmit={runRecommend}
            className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm sm:p-5"
          >
            <h2 className="font-display text-xl tracking-tight text-foreground">
              Purchase details
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Ranking for {CATEGORY_LABELS[category].toLowerCase()}
              {merchant.trim() ? ` · ${merchant.trim()}` : ""}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-foreground">
                  Amount (CAD)
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Purchase amount in CAD"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-foreground">
                  Merchant (optional)
                </span>
                <Input
                  type="text"
                  placeholder="e.g. Loblaws, Cactus Club"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  aria-label="Merchant name"
                />
              </label>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                Category
              </p>
              <CategoryPicker value={category} onChange={setCategory} />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full sm:w-auto"
              disabled={busy || ownedIds.length === 0}
            >
              {busy ? "Ranking…" : "Recommend cards"}
            </Button>
          </form>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="font-display text-xl tracking-tight text-foreground">
                Recommendations
              </h2>
              {recommendations.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {recommendations.length} ranked
                  {lastPurchase
                    ? ` · $${lastPurchase.amountCad.toFixed(2)}`
                    : ""}
                </p>
              )}
            </div>
            <AppResults
              recommendations={recommendations}
              emptyHint={emptyHint}
              amountCad={lastPurchase?.amountCad ?? null}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
