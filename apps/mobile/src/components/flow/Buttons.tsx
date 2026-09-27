import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, fonts, TOUCH } from "../../lib/theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        styles.primary,
        pressed && !inactive && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryFg} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  height = 48,
}: ButtonProps & { height?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.link,
        { height: Math.max(TOUCH, height) },
        pressed && styles.linkPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** Small inline text action ("Change", "Edit", "New search") with a 44px target. */
export function InlineAction({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.inline, pressed && styles.linkPressed]}
    >
      <Text style={styles.inlineText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryText: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.primaryFg,
  },
  disabled: {
    opacity: 0.5,
  },
  link: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.primary,
  },
  inline: {
    minHeight: TOUCH,
    minWidth: TOUCH,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.primary,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
