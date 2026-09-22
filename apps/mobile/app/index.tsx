import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { loadOnboardingComplete } from "../src/lib/onboarding";
import { colors } from "../src/lib/theme";

/**
 * First-launch gate: onboarding once, then straight to the recommender.
 */
export default function IndexGate() {
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done = await loadOnboardingComplete();
      if (!cancelled) {
        setComplete(done);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.boot} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!complete) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
