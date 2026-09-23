import { groupCardsByIssuer, type CreditCard } from "@northtap/core";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../lib/theme";

interface WalletProps {
  cards: CreditCard[];
  cardsLoading?: boolean;
  cardsError?: string | null;
  ownedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  syncHint: string;
}

function feeLabel(card: CreditCard): string {
  return card.annualFee === 0 ? "No fee" : `$${card.annualFee}/yr`;
}

export function Wallet({
  cards,
  cardsLoading,
  cardsError,
  ownedIds,
  onToggle,
  onClear,
  syncHint,
}: WalletProps) {
  const [query, setQuery] = useState("");
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        c.pointCurrency.toLowerCase().includes(q),
    );
  }, [query, cards]);

  const grouped = useMemo(() => groupCardsByIssuer(filtered), [filtered]);
  const issuers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your cards</Text>
          <Text style={styles.subtitle}>
            {`${ownedIds.length} selected · ${syncHint}`}
          </Text>
        </View>
        {ownedIds.length > 0 ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear"
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search issuer, card, or currency…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search cards"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery("")}
            style={styles.clearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearSearchText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {cardsLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.empty}>Loading card catalog…</Text>
        </View>
      ) : cardsError ? (
        <Text style={styles.empty}>{cardsError}</Text>
      ) : (
        <ScrollView
          style={styles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {issuers.length === 0 ? (
            <Text style={styles.empty}>
              {query
                ? `No cards match “${query}”.`
                : "No cards in the catalog yet."}
            </Text>
          ) : null}
          {issuers.map((issuer) => (
            <View key={issuer} style={styles.section}>
              <Text style={styles.issuer}>{issuer}</Text>
              {(grouped[issuer] ?? []).map((card) => {
                const checked = owned.has(card.id);
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => onToggle(card.id)}
                    style={[styles.row, checked && styles.rowChecked]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${card.issuer} ${card.name}`}
                    {...(Platform.OS === "web"
                      ? ({ "aria-checked": checked } as Record<
                          string,
                          boolean
                        >)
                      : null)}
                  >
                    <View style={[styles.box, checked && styles.boxChecked]}>
                      {checked ? <Text style={styles.check}>✓</Text> : null}
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardName}>{card.name}</Text>
                        <Text style={styles.fee}>{feeLabel(card)}</Text>
                      </View>
                      <Text style={styles.meta}>
                        {card.pointCurrency}
                        {card.network ? ` · ${card.network}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    minHeight: 360,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },
  clear: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    paddingVertical: 4,
  },
  searchWrap: {
    position: "relative",
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 36,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.bg,
  },
  clearSearch: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchText: {
    fontSize: 20,
    color: colors.muted,
    lineHeight: 22,
  },
  list: {
    maxHeight: 400,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 32,
    color: colors.muted,
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  issuer: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 4,
  },
  rowChecked: {
    borderColor: "rgba(11, 61, 46, 0.2)",
    backgroundColor: "rgba(11, 61, 46, 0.05)",
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    color: colors.primaryFg,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 8,
  },
  cardName: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.foreground,
  },
  fee: {
    fontSize: 12,
    color: colors.muted,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },
});
