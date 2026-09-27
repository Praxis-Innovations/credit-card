import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { Syne_600SemiBold } from "@expo-google-fonts/syne/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors, fonts, WORDMARK_FONT } from "../src/lib/theme";
import { FlowProvider } from "../src/state/flow";

void SplashScreen.preventAutoHideAsync();

/** Don't hold the UI hostage if a font request stalls. */
const FONT_TIMEOUT_MS = 2500;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [WORDMARK_FONT]: Syne_600SemiBold,
    [fonts.body]: DMSans_400Regular,
    [fonts.medium]: DMSans_500Medium,
    [fonts.semibold]: DMSans_600SemiBold,
  });
  const [timedOut, setTimedOut] = useState(false);
  // Fall back to the system font rather than hold the app on a failed load.
  const ready = fontsLoaded || fontError != null || timedOut;

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <FlowProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </FlowProvider>
    </SafeAreaProvider>
  );
}
