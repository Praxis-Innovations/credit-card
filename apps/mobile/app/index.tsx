import { CARDS, CATEGORIES } from "@northtap/core";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Placeholder shell — full mobile UI lands in a follow-up.
 * Confirms Expo Router + @northtap/core resolve on iOS/Android/Web.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>NorthTap</Text>
        <Text style={styles.title}>Mobile shell</Text>
        <Text style={styles.body}>
          Shared core is wired: {CARDS.length} cards · {CATEGORIES.length}{" "}
          categories. UI builds on top of @northtap/core next.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F7F5",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#0B3D2E",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#10231C",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#3D5A4E",
    maxWidth: 360,
  },
});
