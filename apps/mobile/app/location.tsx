import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinkButton, PrimaryButton } from "../src/components/flow/Buttons";
import { CheckIcon, PinIcon } from "../src/components/flow/Icons";
import { Screen } from "../src/components/flow/Screen";
import { StepHeader } from "../src/components/flow/StepHeader";
import { getForegroundPosition } from "../src/lib/location";
import { useLayout } from "../src/lib/responsive";
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
  const layout = useLayout();
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

  const back = () => (router.canGoBack() ? router.back() : router.replace("/cards"));
  const chooseStore = () => router.push("/store?tab=browse");
  const art = (
    <View
      style={[styles.art, layout.wide && styles.artWide]}
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
  );

  return (
    <Screen
      header={<StepHeader step={2} onBack={back} />}
      footer={
        <>
          <PrimaryButton label="Allow location" onPress={() => void allow()} busy={busy} />
          <LinkButton label="Choose a store instead" onPress={chooseStore} disabled={busy} />
        </>
      }
      step={2}
      actions={{
        onBack: back,
        tertiary: [{ label: "Choose a store instead", onPress: chooseStore, disabled: busy }],
        primary: { label: "Allow location", onPress: () => void allow(), busy },
      }}
    >
      <View
        style={[
          styles.main,
          layout.wide && styles.mainWide,
          layout.desktop && styles.mainDesktop,
        ]}
      >
        {layout.desktop ? null : art}
        <View style={[styles.copy, layout.wide && styles.copyWide, layout.desktop && styles.copyDesktop]}>
          <Text
            style={[styles.h1, layout.wide && styles.h1Wide, layout.desktop && styles.h1Desktop]}
            accessibilityRole="header"
          >
            Find the store you're at
          </Text>
          <Text style={[styles.lead, layout.wide && styles.leadWide, layout.desktop && styles.left]}>
            NorthTap checks which store you're in, so it knows the kind of purchase: gas,
            groceries, dining and more.
          </Text>
          <View style={[styles.list, layout.wide && styles.listWide]} accessibilityRole="list">
            {PROMISES.map((line) => (
              <View key={line} style={styles.item}>
                <CheckIcon />
                <Text style={styles.itemText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
        {layout.desktop ? <View style={styles.artColumn}>{art}</View> : null}
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
  mainWide: {
    paddingTop: 48,
    paddingHorizontal: 0,
    gap: 32,
  },
  mainDesktop: {
    paddingTop: 0,
    minHeight: 560,
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
  },
  copy: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  copyWide: {
    alignSelf: "center",
    width: 520,
    maxWidth: "100%",
  },
  copyDesktop: {
    flex: 1,
    width: undefined,
    alignItems: "flex-start",
  },
  artColumn: {
    width: 360,
    alignItems: "center",
  },
  art: {
    width: 200,
    height: 200,
    marginTop: 16,
  },
  artWide: {
    marginTop: 0,
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
  h1Wide: {
    marginTop: 0,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.6,
  },
  h1Desktop: {
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -0.72,
    textAlign: "left",
  },
  left: {
    textAlign: "left",
  },
  lead: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
    textAlign: "center",
  },
  leadWide: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 27,
  },
  list: {
    marginTop: 28,
    alignSelf: "stretch",
    gap: 12,
  },
  listWide: {
    marginTop: 24,
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
