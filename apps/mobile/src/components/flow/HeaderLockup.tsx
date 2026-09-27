import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../lib/theme";
import { NorthTapMark } from "./Icons";

/**
 * Header lockup (mark + "North" + "Tap") as drawn in the first-run design.
 * Deliberately minimal: the full logo/wordmark component is owned by the
 * app-logo work and should replace this once it lands in apps/mobile.
 */
export function HeaderLockup() {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel="NorthTap"
    >
      <NorthTapMark />
      <Text style={styles.word} aria-hidden>
        North<Text style={styles.tap}>Tap</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  word: {
    fontFamily: fonts.heading,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.text,
  },
  tap: {
    color: colors.primary,
  },
});
