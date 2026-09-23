import { CATEGORIES, CATEGORY_LABELS, type Category } from "../lib/api-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";

interface CategoryPickerProps {
  value: Category;
  onChange: (category: Category) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {CATEGORIES.map((category) => {
        const active = value === category;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={CATEGORY_LABELS[category]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {CATEGORY_LABELS[category]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primaryFg,
  },
});
