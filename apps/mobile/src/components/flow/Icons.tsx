import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../../lib/theme";

type IconProps = { size?: number; color?: string };

export function ChevronLeftIcon({ size = 22, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6l-6 6 6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({
  size = 20,
  color = colors.primary,
  strokeWidth = 2.2,
}: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PinIcon({
  width = 14,
  height = 14,
  hole = colors.bg,
}: {
  width?: number;
  height?: number;
  hole?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 36 40">
      <Path
        fill={colors.primary}
        d="M18 39s-14-12-14-23a14 14 0 0 1 28 0c0 11-14 23-14 23z"
      />
      <Circle cx={18} cy={16} r={5} fill={hole} />
    </Svg>
  );
}

export function InfoIcon({ size = 20, color = colors.warnIcon }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 8v5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 16h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.textBody }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ContactlessIcon({ size = 20 }: IconProps) {
  const stroke = "rgba(255,255,255,0.7)";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 7.5a6 6 0 0 1 0 9" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 5a9.5 9.5 0 0 1 0 14" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M15.5 2.5a13 13 0 0 1 0 19" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function GoogleIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}