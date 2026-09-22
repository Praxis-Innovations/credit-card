import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../src/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen name="(onboarding)" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}
