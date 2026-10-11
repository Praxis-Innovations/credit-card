import { useRouter } from "expo-router";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { NorthTapLogo } from "../src/components/brand/NorthTapLogo";
import { ActionButton, PrimaryButton } from "../src/components/flow/Buttons";
import { ContactlessIcon } from "../src/components/flow/Icons";
import { Screen } from "../src/components/flow/Screen";
import { useLayout } from "../src/lib/responsive";
import { colors, fonts } from "../src/lib/theme";

const ART_WIDTH = 342;
const ART_HEIGHT = 230;

/** Card-stack art scaled to fit `available` width, up to 1.5× on tablet/desktop. */
function CardStack({ available, maxScale }: { available: number; maxScale: number }) {
  const scale = Math.min(maxScale, available / ART_WIDTH);
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

const HINT = "Takes about a minute · no account needed";
const DESKTOP_GAP = 64;

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { wide, desktop, contentWidth, columnMaxWidth } = useLayout();
  const start = () => router.push("/cards");
  const phoneAvailable = Math.min(width, columnMaxWidth ?? width) - 48;

  const heading = (
    <Text
      style={[styles.h1, wide && styles.h1Tablet, desktop && styles.h1Desktop]}
      accessibilityRole="header"
    >
      The right card for every purchase.
    </Text>
  );
  const lead = (
    <Text style={[styles.lead, wide && styles.leadTablet, desktop && styles.leadDesktop]}>
      Tell us which cards you carry. We'll tell you which one to tap, wherever
      you're shopping.
    </Text>
  );

  let body;
  if (desktop && contentWidth !== undefined) {
    const column = (contentWidth - DESKTOP_GAP) / 2;
    body = (
      <View style={styles.desktopGrid}>
        <View style={styles.desktopCopy}>
          {heading}
          {lead}
          <View style={styles.desktopCta}>
            <ActionButton label="Get started" onPress={start} arrow minWidth={220} />
            <Text style={styles.hint}>{HINT}</Text>
          </View>
        </View>
        <View style={styles.desktopArt}>
          <CardStack available={column} maxScale={1.5} />
        </View>
      </View>
    );
  } else {
    body = (
      <View style={[styles.main, wide && styles.mainTablet]}>
        <CardStack
          available={wide && contentWidth !== undefined ? contentWidth : phoneAvailable}
          maxScale={wide ? 1.5 : 1}
        />
        {heading}
        {lead}
      </View>
    );
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <NorthTapLogo size={20} accessibilityRole="image" />
        </View>
      }
      footer={
        <View style={styles.footer}>
          <PrimaryButton label="Get started" onPress={start} />
          <Text style={[styles.hint, styles.center]}>{HINT}</Text>
        </View>
      }
      actions={
        desktop
          ? undefined
          : { note: HINT, primary: { label: "Get started", onPress: start, arrow: true } }
      }
    >
      {body}
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
  mainTablet: {
    paddingTop: 80,
    paddingHorizontal: 0,
  },
  desktopGrid: {
    minHeight: 600,
    flexDirection: "row",
    alignItems: "center",
    gap: DESKTOP_GAP,
  },
  desktopCopy: {
    flex: 1,
    minWidth: 0,
    gap: 20,
  },
  desktopArt: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  desktopCta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
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
  h1Tablet: {
    marginTop: 40,
    maxWidth: 560,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.88,
  },
  h1Desktop: {
    marginTop: 0,
    maxWidth: undefined,
    fontSize: 52,
    lineHeight: 57,
    letterSpacing: -1.04,
    textAlign: "left",
  },
  lead: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
    textAlign: "center",
  },
  leadTablet: {
    marginTop: 24,
    maxWidth: 520,
    fontSize: 18,
    lineHeight: 29,
  },
  leadDesktop: {
    marginTop: 0,
    maxWidth: undefined,
    fontSize: 19,
    lineHeight: 30,
    textAlign: "left",
  },
  footer: {
    gap: 14,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  center: {
    textAlign: "center",
  },
});
