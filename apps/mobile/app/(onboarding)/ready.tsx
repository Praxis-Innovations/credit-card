import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { FadeIn } from "../../src/components/onboarding/FadeIn";
import {
  OnboardingLead,
  OnboardingShell,
  PrimaryButton,
} from "../../src/components/onboarding/OnboardingShell";
import { markOnboardingComplete } from "../../src/lib/onboarding";
import { colors } from "../../src/lib/theme";

export default function ReadyScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await markOnboardingComplete();
      router.replace("/home");
    } catch {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      footer={
        <>
          <PrimaryButton
            label={busy ? "Opening…" : "Continue as guest"}
            onPress={() => void finish()}
            accessibilityLabel="Continue as guest"
          />
          {busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 4 }} />
          ) : null}
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <OnboardingLead
          eyebrow="You're ready"
          title="Start as a guest. Sign in when you want sync."
          body="Guest mode saves your wallet on this device. Create an account later to keep the same cards across sessions and phones."
        />

        <FadeIn delay={120}>
          <View style={styles.compare}>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Guest</Text>
              <Text style={styles.colTitle}>Full recommender</Text>
              <Text style={styles.colBody}>
                Rank purchases and keep a local wallet — no account needed.
              </Text>
            </View>
            <View style={[styles.col, styles.colAccent]}>
              <Text style={[styles.colLabel, styles.colLabelAccent]}>
                Signed in
              </Text>
              <Text style={[styles.colTitle, styles.colTitleAccent]}>
                Synced wallet
              </Text>
              <Text style={[styles.colBody, styles.colBodyAccent]}>
                Same cards on every device via your NorthTap account.
              </Text>
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={220}>
          <Text style={styles.hint}>
            Sign-in lives on the home screen whenever you're ready — it never
            blocks recommendations.
          </Text>
        </FadeIn>
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
  compare: {
    gap: 12,
  },
  col: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  colAccent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
  },
  colLabelAccent: {
    color: colors.accent,
  },
  colTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  colTitleAccent: {
    color: colors.primaryFg,
  },
  colBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  colBodyAccent: {
    color: "rgba(244, 247, 245, 0.8)",
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
});
