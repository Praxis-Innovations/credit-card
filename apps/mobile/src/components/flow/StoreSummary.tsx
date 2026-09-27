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
  /** "card" = boxed row (amount screen); "plain" = unboxed (result screen). */
  variant?: "card" | "plain";
}

export function StoreSummary({
  name,
  meta,
  logoUrl,
  logoAlt,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
  variant = "card",
}: StoreSummaryProps) {
  const plain = variant === "plain";
  return (
    <View style={[styles.row, !plain && styles.card]}>
      <StoreLogo name={name} logoUrl={logoUrl} logoAlt={logoAlt} size={plain ? 44 : 40} />
      <View style={styles.text}>
        <Text style={[styles.name, plain && styles.namePlain]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, plain && styles.metaPlain]}>{meta}</Text>
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
  namePlain: {
    fontSize: 17,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  metaPlain: {
    fontSize: 14,
    color: colors.textBody,
  },
});
