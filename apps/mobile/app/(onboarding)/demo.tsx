import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { DemoRecommendationCard } from "../../src/components/onboarding/DemoRecommendationCard";
import {
  OnboardingLead,
  OnboardingShell,
  PrimaryButton,
} from "../../src/components/onboarding/OnboardingShell";

export default function DemoScreen() {
  const router = useRouter();

  return (
    <OnboardingShell
      step={2}
      totalSteps={3}
      footer={
        <PrimaryButton
          label="Got it — continue"
          onPress={() => router.push("/ready")}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <OnboardingLead
          eyebrow="Live demo"
          title="Here's what NorthTap tells you."
          body="No signup required — this ranking runs on the same engine as the full app."
        />
        <DemoRecommendationCard />
      </ScrollView>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
});
