import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { loadOnboardingComplete } from "../src/lib/onboarding";
import { colors } from "../src/lib/theme";
import { useFlow } from "../src/state/flow";

/**
 * First launch → intro. Returning users with a wallet go straight to
 * "Where are you shopping?".
 */
export default function IndexGate() {
  const { hydrated, walletIds } = useFlow();
  const [complete, setComplete] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOnboardingComplete().then((done) => {
      if (!cancelled) setComplete(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (complete === null || !hydrated) {
    return (
      <View style={styles.boot} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (complete && walletIds.length > 0) {
    return <Redirect href="/store" />;
  }
  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
