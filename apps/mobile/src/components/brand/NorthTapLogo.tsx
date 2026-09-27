import {
  type AccessibilityRole,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { brand, WORDMARK_FONT } from "../../lib/theme";

/** `light`: teal card for light backgrounds. `teal`: white card for teal/dark. */
export type LogoTone = "light" | "teal";

const MARK_VIEWBOX = { width: 76, height: 54 };

const palettes = {
  light: {
    card: brand.teal,
    needle: brand.white,
    needleShade: brand.paleTeal,
    chip: brand.white,
    north: brand.ink,
    tap: brand.teal,
  },
  teal: {
    card: brand.white,
    needle: brand.teal,
    needleShade: brand.needleShade,
    chip: brand.teal,
    north: brand.white,
    tap: brand.paleTeal,
  },
} as const;

/** Geometry must match assets/brand/northtap-mark.svg exactly. */
export function NorthTapMark({
  height,
  tone = "light",
}: {
  height: number;
  tone?: LogoTone;
}) {
  const c = palettes[tone];
  const width = (height * MARK_VIEWBOX.width) / MARK_VIEWBOX.height;
  return (
    <Svg width={width} height={height} viewBox="12 24 76 54">
      <Rect x="13" y="25" width="74" height="52" rx="11" fill={c.card} />
      <Path d="M35 39 L35 57 L26 63 Z" fill={c.needle} />
      <Path d="M35 39 L44 63 L35 57 Z" fill={c.needleShade} />
      <Rect x="62" y="39" width="12" height="9" rx="2" fill={c.chip} />
      <Rect x="62" y="59.6" width="12" height="3.4" rx="1.7" fill={c.chip} />
    </Svg>
  );
}

interface NorthTapLogoProps {
  /** Wordmark font size; the mark scales with it. */
  size?: number;
  tone?: LogoTone;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
}

/** Mark + "NorthTap" wordmark lockup. */
export function NorthTapLogo({
  size = 22,
  tone = "light",
  accessibilityRole,
  style,
}: NorthTapLogoProps) {
  const c = palettes[tone];
  return (
    <View
      style={[styles.row, { gap: Math.round(size * 0.4) }, style]}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel="NorthTap"
    >
      <NorthTapMark height={Math.round(size * 1.15)} tone={tone} />
      <Text
        style={[
          styles.wordmark,
          {
            color: c.north,
            fontSize: size,
            lineHeight: Math.round(size * 1.2),
            letterSpacing: -0.02 * size,
          },
        ]}
      >
        North<Text style={{ color: c.tap }}>Tap</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordmark: {
    fontFamily: WORDMARK_FONT,
  },
});
