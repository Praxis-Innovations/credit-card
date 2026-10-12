import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../lib/theme";
import { InlineAction } from "./Buttons";
import { StoreLogo } from "./Logos";

interface StoreSummaryProps {
  name: string;
  meta: string;
  logoUrl: string | null | undefined;
  logoAlt?: string | null;
  actionLabel: string;
  actionAccessibilityLabel: string;
  onAction: () => void;
}

export function StoreSummary({
  name,
  meta,
  logoUrl,
  logoAlt,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
}: StoreSummaryProps) {
  return (
    <View style={[styles.row, styles.card]}>
      <StoreLogo name={name} logoUrl={logoUrl} logoAlt={logoAlt} size={40} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <InlineAction
        label={actionLabel}
        accessibilityLabel={actionAccessibilityLabel}
        onPress={onAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
});
