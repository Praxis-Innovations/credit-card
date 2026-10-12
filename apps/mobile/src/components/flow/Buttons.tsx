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
import { ArrowRightIcon } from "./Icons";
import { pressState } from "./press-state";

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Phone primary: full width, 52px. */
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
      style={(state) => {
        const { pressed, hovered } = pressState(state);
        return [
          styles.primary,
          (pressed || hovered) && !inactive && styles.primaryPressed,
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryFg} />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Tablet/desktop primary: 48px, sized to its label with a minimum width. */
export function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  accessibilityLabel,
  style,
  minWidth = 180,
  arrow,
}: ButtonProps & { minWidth?: number; arrow?: boolean }) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={(state) => {
        const { pressed, hovered } = pressState(state);
        return [
          styles.action,
          { minWidth },
          (pressed || hovered) && !inactive && styles.primaryPressed,
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryFg} />
      ) : (
        <>
          <Text style={styles.actionText}>{label}</Text>
          {arrow ? <ArrowRightIcon /> : null}
        </>
      )}
    </Pressable>
  );
}

/** White button with a grey outline and an optional leading icon. */
export function OutlineButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  icon,
  height = 44,
}: ButtonProps & { icon?: ReactNode; height?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={(state) => {
        const { pressed, hovered } = pressState(state);
        return [
          styles.outline,
          { height: Math.max(TOUCH, height) },
          hovered && !disabled && styles.outlineHover,
          pressed && !disabled && styles.outlinePressed,
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      {icon}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

/** Round 44px outlined icon button (phone "New search"). */
export function IconButton({
  accessibilityLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={(state) => {
        const { pressed, hovered } = pressState(state);
        return [
          styles.iconButton,
          hovered && styles.outlineHover,
          pressed && styles.outlinePressed,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}

/** Teal text action: phone secondary actions, tablet/desktop tertiary actions. */
export function LinkButton({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  style,
  height = 48,
  strong,
}: ButtonProps & { height?: number; strong?: boolean }) {
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
      {(state) => (
        <Text
          style={[
            styles.linkText,
            strong && styles.linkTextStrong,
            pressState(state).hovered && !disabled && styles.hoverText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Small inline text action ("Change") with a 44px target. */
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
      {(state) => (
        <Text style={[styles.inlineText, pressState(state).hovered && styles.hoverText]}>
          {label}
        </Text>
      )}
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
  action: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.primaryFg,
  },
  outline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderInput,
  },
  outlineHover: {
    borderColor: colors.primary,
  },
  outlinePressed: {
    backgroundColor: colors.tint,
  },
  outlineText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  iconButton: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    borderWidth: 1,
    borderColor: colors.borderInput,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
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
  linkTextStrong: {
    fontFamily: fonts.semibold,
  },
  hoverText: {
    color: colors.primaryPressed,
    textDecorationLine: "underline",
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
