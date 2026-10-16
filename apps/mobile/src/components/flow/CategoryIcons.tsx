import type { ReactElement } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { Category } from "../../lib/api-types";
import { CATEGORY_ICON_IDS } from "../../lib/store-logo";
import { colors } from "../../lib/theme";

type IconProps = { size?: number; color?: string };

const stroke = {
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Cup — dining. */
function DiningIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8h10v3a5 5 0 0 1-10 0V8z" stroke={color} {...stroke} />
      <Path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16" stroke={color} {...stroke} />
      <Path d="M9 18h6" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Cart — groceries. */
function GroceriesIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5h2l2.2 10h9.6L19 8H7" stroke={color} {...stroke} />
      <Circle cx={9} cy={19} r={1.4} stroke={color} strokeWidth={1.8} />
      <Circle cx={16} cy={19} r={1.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** Pump — gas. */
function GasIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" stroke={color} {...stroke} />
      <Path d="M5 10h10" stroke={color} {...stroke} />
      <Path d="M15 9l3 2v5a2 2 0 0 0 2 2" stroke={color} {...stroke} />
      <Path d="M3 20h14" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Cross — drugstore. */
function DrugstoreIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4z" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Suitcase — travel. */
function TravelIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={8} width={16} height={11} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke={color} {...stroke} />
      <Path d="M4 13h16" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Bus — transit. */
function TransitIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5h14v11H5V5z" stroke={color} {...stroke} />
      <Path d="M5 11h14" stroke={color} {...stroke} />
      <Path d="M7 19v-1M17 19v-1" stroke={color} {...stroke} />
      <Circle cx={8} cy={14.5} r={1} fill={color} />
      <Circle cx={16} cy={14.5} r={1} fill={color} />
      <Path d="M7 5V4h10v1" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Star — entertainment. */
function EntertainmentIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4l2.2 4.6L19 9.3l-3.5 3.4.8 4.8L12 15.2 7.7 17.5l.8-4.8L5 9.3l4.8-.7L12 4z"
        stroke={color}
        {...stroke}
      />
    </Svg>
  );
}

/** Calendar bill — recurring bills. */
function BillsIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 3v4M16 3v4M4 10h16" stroke={color} {...stroke} />
      <Path d="M8 14h8M8 17h5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Currency — foreign currency. */
function CurrencyIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v10M9.5 9.5c.6-1 1.5-1.5 2.5-1.5 1.7 0 3 1 3 2.5S13.7 13 12 13s-3 1-3 2.5 1.3 2.5 3 2.5c1 0 1.9-.5 2.5-1.5" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Grid — everything else. */
function OtherIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={6} height={6} rx={1} stroke={color} strokeWidth={1.8} />
      <Rect x={14} y={4} width={6} height={6} rx={1} stroke={color} strokeWidth={1.8} />
      <Rect x={4} y={14} width={6} height={6} rx={1} stroke={color} strokeWidth={1.8} />
      <Rect x={14} y={14} width={6} height={6} rx={1} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

const ICONS: Record<Category, (props: IconProps) => ReactElement> = {
  dining: DiningIcon,
  groceries: GroceriesIcon,
  gas: GasIcon,
  drugstore: DrugstoreIcon,
  travel: TravelIcon,
  transit: TransitIcon,
  entertainment: EntertainmentIcon,
  recurring_bills: BillsIcon,
  foreign_currency: CurrencyIcon,
  other: OtherIcon,
};

/** Compile-time check: every category id has an icon component. */
const _allCategoriesHaveIcons: Record<(typeof CATEGORY_ICON_IDS)[number], unknown> = ICONS;
void _allCategoriesHaveIcons;

export function CategoryIcon({
  category,
  size = 20,
  color = colors.primary,
}: IconProps & { category: Category }) {
  const Icon = ICONS[category] ?? OtherIcon;
  return <Icon size={size} color={color} />;
}
