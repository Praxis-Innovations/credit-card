import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinkButton, PrimaryButton } from "../src/components/flow/Buttons";
import { CheckIcon, PinIcon } from "../src/components/flow/Icons";
import { Screen } from "../src/components/flow/Screen";
import { StepHeader } from "../src/components/flow/StepHeader";
import { getForegroundPosition } from "../src/lib/location";
import { colors, fonts } from "../src/lib/theme";
import { useFlow } from "../src/state/flow";

const PROMISES = [
  "Only while the app is open",
  "Never stored on our servers",
  "Or choose the store yourself, anytime",
];

export default function LocationScreen() {
  const router = useRouter();
  const { setLocation } = useFlow();
  const [busy, setBusy] = useState(false);

  async function allow() {
    setBusy(true);
    const result = await getForegroundPosition();
    setBusy(false);
    if (result.ok) {
      setLocation({ status: "granted", point: result.point });
      router.push("/store?tab=nearby");
      return;
    }
    setLocation({ status: result.reason, message: result.message });
    router.push("/store?tab=browse");
  }

  return (
    <Screen
      header={
        <StepHeader
          step={2}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/cards"))}
        />
      }
      footer={
        <>
          <PrimaryButton label="Allow location" onPress={() => void allow()} busy={busy} />
          <LinkButton
            label="Choose a store instead"
            onPress={() => router.push("/store?tab=browse")}
            disabled={busy}
          />
        </>
      }
    >
      <View style={styles.main}>
        <View
          style={styles.art}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.outer} />
          <View style={styles.inner} />
          <View style={styles.pin}>
            <PinIcon width={64} height={80} />
          </View>
        </View>
        <Text style={styles.h1} accessibilityRole="header">
          Find the store you're at
        </Text>
        <Text style={styles.lead}>
          NorthTap checks which store you're in, so it can use that store's card
          partnerships.
        </Text>
        <View style={styles.list} accessibilityRole="list">
          {PROMISES.map((line) => (
            <View key={line} style={styles.item}>
              <CheckIcon />
              <Text style={styles.itemText}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  main: {
    paddingTop: 24,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  art: {
    width: 200,
    height: 200,
    marginTop: 16,
  },
  outer: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.tint,
  },
  inner: {
    position: "absolute",
    left: 40,
    top: 40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.tintStrong,
  },
  pin: {
    position: "absolute",
    left: 68,
    top: 60,
  },
  h1: {
    marginTop: 40,
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    color: colors.text,
    textAlign: "center",
  },
  lead: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
    textAlign: "center",
  },
  list: {
    marginTop: 28,
    alignSelf: "stretch",
    gap: 12,
  },
  item: {
    flexDirection: "row",
    gap: 12,
  },
  itemText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});
