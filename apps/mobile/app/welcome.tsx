import { useRouter } from "expo-router";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { NorthTapLogo } from "../src/components/brand/NorthTapLogo";
import { PrimaryButton } from "../src/components/flow/Buttons";
import { ContactlessIcon } from "../src/components/flow/Icons";
import { Screen } from "../src/components/flow/Screen";
import { useLayout } from "../src/lib/responsive";
import { colors, fonts } from "../src/lib/theme";

const ART_WIDTH = 342;
const ART_HEIGHT = 230;

function CardStack() {
  const { width } = useWindowDimensions();
  const { columnMaxWidth } = useLayout();
  const available = Math.min(width, columnMaxWidth ?? width) - 48;
  const scale = Math.min(1, available / ART_WIDTH);
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: ART_WIDTH * scale, height: ART_HEIGHT * scale }}
    >
      <View style={[styles.art, { transform: [{ scale }] }]}>
        <View style={styles.backCard} />
        <View style={styles.frontCard}>
          <View style={styles.chip} />
          <View style={styles.contactless}>
            <ContactlessIcon />
          </View>
          <Text style={styles.number}>•••• 4821</Text>
          <View style={styles.circles}>
            <View style={[styles.circle, { backgroundColor: "rgba(255,255,255,0.35)" }]} />
            <View
              style={[
                styles.circle,
                { backgroundColor: "rgba(255,255,255,0.2)", marginLeft: -8 },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { desktop } = useLayout();
  return (
    <Screen
      header={
        desktop ? undefined : (
          <View style={styles.header}>
            <NorthTapLogo size={20} accessibilityRole="image" />
          </View>
        )
      }
      footer={
        <View style={styles.footer}>
          <PrimaryButton label="Get started" onPress={() => router.push("/cards")} />
          <Text style={styles.hint}>Takes about a minute · no account needed</Text>
        </View>
      }
    >
      <View style={styles.main}>
        <CardStack />
        <Text style={styles.h1} accessibilityRole="header">
          The right card for every purchase.
        </Text>
        <Text style={styles.lead}>
          Tell us which cards you carry. We'll tell you which one to tap, wherever
          you're shopping.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  main: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  art: {
    width: ART_WIDTH,
    height: ART_HEIGHT,
    transformOrigin: "top left",
  },
  backCard: {
    position: "absolute",
    left: 16,
    top: 31,
    width: 270,
    height: 170,
    borderRadius: 14,
    backgroundColor: colors.tintStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: "-8deg" }],
  },
  frontCard: {
    position: "absolute",
    left: 41,
    top: 14,
    width: 270,
    height: 170,
    borderRadius: 14,
    backgroundColor: colors.primary,
    transform: [{ rotate: "-3deg" }],
  },
  chip: {
    position: "absolute",
    left: 22,
    top: 45,
    width: 36,
    height: 26,
    borderRadius: 4,
    backgroundColor: colors.chip,
  },
  contactless: {
    position: "absolute",
    right: 20,
    top: 20,
  },
  number: {
    position: "absolute",
    left: 22,
    bottom: 20,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 1.7,
    color: "rgba(255,255,255,0.85)",
  },
  circles: {
    position: "absolute",
    right: 20,
    bottom: 18,
    flexDirection: "row",
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  h1: {
    marginTop: 32,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.text,
    textAlign: "center",
  },
  lead: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
    textAlign: "center",
  },
  footer: {
    gap: 14,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
});
