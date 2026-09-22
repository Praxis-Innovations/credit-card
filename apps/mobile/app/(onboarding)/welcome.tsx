import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FadeIn } from "../../src/components/onboarding/FadeIn";
import {
  OnboardingLead,
  OnboardingShell,
  PrimaryButton,
} from "../../src/components/onboarding/OnboardingShell";
import { colors } from "../../src/lib/theme";

const POINTS = [
  {
    title: "Your wallet, ranked",
    body: "Not a generic top-ten — cards you already carry.",
  },
  {
    title: "Purchase-specific",
    body: "Amount + category in, clear pick out.",
  },
  {
    title: "Try before you sign in",
    body: "Guest mode works on this device. Account unlocks sync.",
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <OnboardingShell
      step={1}
      totalSteps={3}
      footer={
        <PrimaryButton
          label="See it in action"
          onPress={() => router.push("/demo")}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <OnboardingLead
          eyebrow="Canadian rewards"
          title="Tap the right card, every time."
          body="NorthTap ranks the cards in your wallet for this purchase — before you pay."
        />

        <View style={styles.points}>
          {POINTS.map((point, index) => (
            <FadeIn key={point.title} delay={120 + index * 90}>
              <View style={styles.point}>
                <View style={styles.pointMark}>
                  <Text style={styles.pointMarkText}>{index + 1}</Text>
                </View>
                <View style={styles.pointCopy}>
                  <Text style={styles.pointTitle}>{point.title}</Text>
                  <Text style={styles.pointBody}>{point.body}</Text>
                </View>
              </View>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
  points: {
    gap: 12,
  },
  point: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  pointMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.mutedBg,
    alignItems: "center",
    justifyContent: "center",
  },
  pointMarkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  pointCopy: {
    flex: 1,
    gap: 4,
  },
  pointTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
  },
  pointBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
