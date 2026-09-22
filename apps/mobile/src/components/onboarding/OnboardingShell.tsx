import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { FadeIn } from "./FadeIn";

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function OnboardingShell({
  step,
  totalSteps,
  children,
  footer,
}: OnboardingShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.top}>
        <Text style={styles.brand} accessibilityRole="header">
          NorthTap
        </Text>
        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step} of ${totalSteps}`}
          accessibilityValue={{ min: 1, max: totalSteps, now: step }}
        >
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, i + 1 === step && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.body}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  accessibilityLabel,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function SecondaryButton({
  label,
  onPress,
  accessibilityLabel,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function OnboardingLead({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <FadeIn style={styles.lead}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.bodyText}>{body}</Text>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brand: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 10,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  lead: {
    gap: 10,
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.primary,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.primaryFg,
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
