import {
  CATEGORY_LABELS,
  type Category,
} from "@northtap/core";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthPanel } from "../src/components/AuthPanel";
import { CategoryPicker } from "../src/components/CategoryPicker";
import { Results } from "../src/components/Results";
import { Wallet } from "../src/components/Wallet";
import type { RecommendationItem, RecommendationResponse } from "../src/lib/api-types";
import { buildRecommendationResponse } from "../src/lib/recommend";
import { loadGuestWallet, saveGuestWallet } from "../src/lib/storage";
import { getSupabaseClient } from "../src/lib/supabase";
import { colors } from "../src/lib/theme";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

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

  // Load guest wallet from AsyncStorage once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = await loadGuestWallet();
      if (!cancelled) {
        setOwnedIds(ids);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist guest wallet when signed out.
  useEffect(() => {
    if (!hydrated || user) return;
    void saveGuestWallet(ownedIds);
  }, [ownedIds, hydrated, user]);

  // When signed in, load wallet from Supabase user_cards.
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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

  function runRecommend() {
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

    const result = buildRecommendationResponse({
      amountCad,
      category,
      merchant: merchant.trim() || undefined,
      ownedCardIds: ownedIds,
      limit: 10,
    });

    if ("error" in result) {
      setError(result.error.message);
      setBusy(false);
      return;
    }

    setRecommendations(result.recommendations);
    setLastPurchase(result.purchase);
    setBusy(false);
  }

  const syncHint = user
    ? walletBusy
      ? "syncing…"
      : "synced to Supabase"
    : "saved on this device";

  const emptyHint =
    ownedIds.length === 0
      ? "Add cards to your wallet, then describe a purchase."
      : "Fill in the purchase and hit Recommend.";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>NorthTap</Text>
          <Text style={styles.headerSub}>Purchase recommender</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>Functional app</Text>
          <Text style={styles.h1} accessibilityRole="header">
            Which card for this purchase?
          </Text>
          <Text style={styles.lead}>
            Enter an amount and merchant/category. We rank your wallet with
            clear reasoning — powered by the shared NorthTap engine and
            Supabase-backed ownership when you sign in.
          </Text>
        </View>

        <AuthPanel user={user} onUserChange={onUserChange} />

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.grid, wide && styles.gridWide]}>
          <View style={[styles.col, wide && styles.colWallet]}>
            <Wallet
              ownedIds={ownedIds}
              onToggle={toggleCard}
              onClear={clearWallet}
              syncHint={syncHint}
            />
          </View>

          <View style={[styles.col, wide && styles.colMain]}>
            <View style={styles.purchaseCard}>
              <Text style={styles.sectionTitle}>Purchase details</Text>
              <Text style={styles.sectionSub}>
                Ranking for {CATEGORY_LABELS[category].toLowerCase()}
                {merchant.trim() ? ` · ${merchant.trim()}` : ""}
              </Text>

              <View style={[styles.fields, wide && styles.fieldsRow]}>
                <View style={styles.field}>
                  <Text style={styles.label}>Amount (CAD)</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Purchase amount in CAD"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Merchant (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={merchant}
                    onChangeText={setMerchant}
                    placeholder="e.g. Loblaws, Cactus Club"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel="Merchant name"
                  />
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>Category</Text>
              <CategoryPicker value={category} onChange={setCategory} />

              <Pressable
                onPress={runRecommend}
                disabled={busy || ownedIds.length === 0}
                style={[
                  styles.recommendBtn,
                  (busy || ownedIds.length === 0) && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Recommend cards"
                accessibilityState={{
                  disabled: busy || ownedIds.length === 0,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryFg} />
                ) : (
                  <Text style={styles.recommendBtnText}>Recommend cards</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {recommendations.length > 0 ? (
                <Text style={styles.rankedMeta}>
                  {recommendations.length} ranked
                  {lastPurchase
                    ? ` · $${lastPurchase.amountCad.toFixed(2)}`
                    : ""}
                </Text>
              ) : null}
            </View>
            <Results
              recommendations={recommendations}
              emptyHint={emptyHint}
              amountCad={lastPurchase?.amountCad ?? null}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    paddingBottom: 64,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
    gap: 20,
  },
  intro: {
    maxWidth: 640,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.primary,
  },
  h1: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  error: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
  },
  grid: {
    gap: 20,
  },
  gridWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  col: {
    gap: 16,
  },
  colWallet: {
    flex: 1,
    minWidth: 0,
  },
  colMain: {
    flex: 1.1,
    minWidth: 0,
  },
  purchaseCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  sectionSub: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 13,
    color: colors.muted,
  },
  fields: {
    gap: 12,
  },
  fieldsRow: {
    flexDirection: "row",
  },
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.bg,
  },
  recommendBtn: {
    marginTop: 20,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 160,
    alignItems: "center",
  },
  recommendBtnText: {
    color: colors.primaryFg,
    fontWeight: "700",
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  rankedMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
});
