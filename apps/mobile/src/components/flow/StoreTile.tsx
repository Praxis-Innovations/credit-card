import { Children, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../lib/theme";
import { StoreLogo } from "./Logos";

interface StoreTileProps {
  name: string;
  meta: string;
  logoUrl: string | null | undefined;
  logoAlt?: string | null;
  partner: boolean;
  onPress: () => void;
}

/** One cell of the 3-column store grid. */
export function StoreTile({ name, meta, logoUrl, logoAlt, partner, onPress }: StoreTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}${partner ? ", has a card partnership" : ""}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {partner ? <View style={styles.dot} /> : null}
      <StoreLogo name={name} logoUrl={logoUrl} logoAlt={logoAlt} />
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

const GAP = 10;

/** Lays tiles out three to a row with 10px gaps. */
export function TileGrid({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const tileWidth = width > 0 ? Math.floor((width - GAP * 2) / 3) : undefined;
  return (
    <View
      style={styles.grid}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {Children.map(children, (child) =>
        child ? <View style={{ width: tileWidth ?? "31%" }}>{child}</View> : null,
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
  tile: {
    position: "relative",
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  pressed: {
    borderColor: colors.primary,
  },
  dot: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 17,
    color: colors.text,
    textAlign: "center",
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
