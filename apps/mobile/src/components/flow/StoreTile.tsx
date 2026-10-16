import { Children, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Category } from "../../lib/api-types";
import { useLayout } from "../../lib/responsive";
import { colors, fonts, TOUCH } from "../../lib/theme";
import { StoreLogo } from "./Logos";
import { pressState } from "./press-state";

interface StoreTileProps {
  name: string;
  meta: string;
  logoUrl: string | null | undefined;
  logoAlt?: string | null;
  /** MCC display group for the category-icon fallback. */
  category: Category;
  onPress: () => void;
}

/** One store row: 40px logo left of the name (DS4 / MO3). */
export function StoreTile({
  name,
  meta,
  logoUrl,
  logoAlt,
  category,
  onPress,
}: StoreTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}`}
      style={(state) => {
        const { pressed, hovered } = pressState(state);
        return [styles.row, hovered && styles.hovered, pressed && styles.pressed];
      }}
    >
      <StoreLogo
        name={name}
        logoUrl={logoUrl}
        logoAlt={logoAlt}
        category={category}
        size={40}
      />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

const GAP = 10;

/** Lays store rows out in 1 (phone/tablet) or 2 (desktop) columns. */
export function TileGrid({ children }: { children: ReactNode }) {
  const { storeColumns } = useLayout();
  const [width, setWidth] = useState(0);
  const colWidth =
    width > 0 ? Math.floor((width - GAP * (storeColumns - 1)) / storeColumns) : undefined;
  return (
    <View
      style={styles.grid}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID="store-tile-grid"
    >
      {Children.map(children, (child) =>
        child ? (
          <View
            style={{
              width: colWidth ?? (`${Math.floor(100 / storeColumns) - 2}%` as const),
            }}
          >
            {child}
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: TOUCH,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hovered: {
    borderColor: colors.primary,
  },
  pressed: {
    borderColor: colors.primary,
    backgroundColor: colors.tint,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
});
