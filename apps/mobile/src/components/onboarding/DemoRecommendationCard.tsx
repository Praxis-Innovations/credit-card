import { useMemo, useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import {
  buildOnboardingDemoRecommendation,
  formatDemoEarnLabel,
} from "../../lib/onboarding-demo";
import { formatCad, formatCentsPerDollar } from "../../lib/format";
import { colors } from "../../lib/theme";
import { FadeIn } from "./FadeIn";

const useNativeDriver = Platform.OS !== "web";

export function DemoRecommendationCard() {
  const demo = useMemo(() => buildOnboardingDemoRecommendation(), []);
  const top = demo.recommendations[0];
  const runnerUps = demo.recommendations.slice(1, 3);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(reveal, {
      toValue: 1,
      friction: 9,
      tension: 60,
      delay: 180,
      useNativeDriver,
    }).start();
  }, [reveal]);

  if (!top) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Unable to load demo ranking.</Text>
      </View>
    );
  }

  const scale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <FadeIn delay={80} style={styles.wrap}>
      <View style={styles.purchaseChip}>
        <Text style={styles.purchaseLabel}>Sample purchase</Text>
        <Text style={styles.purchaseValue}>
          ${demo.purchase.amountCad.toFixed(2)} dinner ·{" "}
          {demo.purchase.merchant}
        </Text>
      </View>

      <Animated.View
        style={[
          styles.hero,
          { opacity: reveal, transform: [{ scale }] },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`NorthTap recommends ${top.card.name}. ${formatDemoEarnLabel(top)}. About ${formatCad(top.estimatedRewardCad)} back.`}
      >
        <Text style={styles.heroEyebrow}>Tap this card</Text>
        <Text style={styles.heroIssuer}>{top.card.issuer}</Text>
        <Text style={styles.heroName}>{top.card.name}</Text>
        <Text style={styles.heroEarn}>{formatDemoEarnLabel(top)}</Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroBack}>{formatCad(top.estimatedRewardCad)}</Text>
          <Text style={styles.heroMeta}>
            est. back · {formatCentsPerDollar(top.centsPerDollar)}
          </Text>
        </View>
        <Text style={styles.heroReason}>{top.reason}</Text>
      </Animated.View>

      {runnerUps.length > 0 ? (
        <View style={styles.runners} accessibilityLabel="Also ranked">
          {runnerUps.map((rec) => (
            <View key={rec.card.id} style={styles.runner}>
              <View style={styles.runnerMain}>
                <View style={styles.runnerRank}>
                  <Text style={styles.runnerRankText}>{rec.rank}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.runnerName}>{rec.card.name}</Text>
                  <Text style={styles.runnerEarn}>
                    {formatDemoEarnLabel(rec)}
                  </Text>
                </View>
              </View>
              <Text style={styles.runnerBack}>
                {formatCad(rec.estimatedRewardCad)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  purchaseChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.mutedBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  purchaseLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  purchaseValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 22,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: 6,
  },
  heroIssuer: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(244, 247, 245, 0.65)",
  },
  heroName: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.primaryFg,
    letterSpacing: -0.6,
  },
  heroEarn: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  heroBack: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primaryFg,
  },
  heroMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(244, 247, 245, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroReason: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(244, 247, 245, 0.85)",
  },
  runners: {
    gap: 8,
  },
  runner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  runnerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  runnerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mutedBg,
  },
  runnerRankText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  runnerName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  runnerEarn: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  runnerBack: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  fallback: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackText: {
    color: colors.muted,
  },
});
