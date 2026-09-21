import { StyleSheet, Text, View } from "react-native";
import type { RecommendationItem } from "../lib/api-types";
import { formatCad, formatCentsPerDollar } from "../lib/format";
import { colors } from "../lib/theme";

interface ResultsProps {
  recommendations: RecommendationItem[];
  emptyHint: string;
  amountCad: number | null;
}

export function Results({
  recommendations,
  emptyHint,
  amountCad,
}: ResultsProps) {
  if (recommendations.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyHint}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.list}
      accessibilityRole="list"
      accessibilityLabel="Ranked card recommendations"
    >
      {recommendations.map((rec) => {
        const isTop = rec.rank === 1;
        return (
          <View
            key={rec.card.id}
            style={[styles.item, isTop && styles.itemTop]}
          >
            <View style={styles.itemMain}>
              <View style={styles.rankRow}>
                <View style={[styles.rankBadge, isTop && styles.rankBadgeTop]}>
                  <Text
                    style={[styles.rankText, isTop && styles.rankTextTop]}
                  >
                    {isTop ? "★" : rec.rank}
                  </Text>
                </View>
                <Text
                  style={[styles.issuer, isTop && styles.issuerTop]}
                >
                  {rec.card.issuer}
                </Text>
              </View>
              <Text
                style={[styles.name, isTop && styles.nameTop]}
                accessibilityRole="header"
              >
                {rec.card.name}
              </Text>
              <Text style={[styles.reason, isTop && styles.reasonTop]}>
                {rec.reason}
              </Text>
            </View>
            <View style={styles.reward}>
              <Text style={[styles.rewardAmount, isTop && styles.rewardAmountTop]}>
                {formatCad(rec.estimatedRewardCad)}
              </Text>
              <Text style={[styles.rewardMeta, isTop && styles.rewardMetaTop]}>
                est. back
                {amountCad
                  ? ` · ${formatCentsPerDollar(rec.centsPerDollar)}`
                  : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 180,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 320,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  itemTop: {
    borderColor: "rgba(11, 61, 46, 0.3)",
    backgroundColor: colors.primary,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mutedBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeTop: {
    backgroundColor: "rgba(244, 247, 245, 0.15)",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  rankTextTop: {
    color: colors.primaryFg,
  },
  issuer: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    opacity: 0.8,
  },
  issuerTop: {
    color: colors.primaryFg,
    opacity: 0.7,
  },
  name: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  nameTop: {
    color: colors.primaryFg,
  },
  reason: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  reasonTop: {
    color: "rgba(244, 247, 245, 0.85)",
  },
  reward: {
    alignItems: "flex-end",
  },
  rewardAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
  },
  rewardAmountTop: {
    color: colors.accent,
  },
  rewardMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  rewardMetaTop: {
    color: "rgba(244, 247, 245, 0.65)",
  },
});
