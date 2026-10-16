import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../lib/theme";
import { StoreLogo } from "./Logos";

interface StoreSummaryProps {
  name: string;
  meta: string;
  logoUrl: string | null | undefined;
  logoAlt?: string | null;
  /** Outline "Change store" button (or similar), shown under the store row. */
  action: ReactNode;
}

export function StoreSummary({ name, meta, logoUrl, logoAlt, action }: StoreSummaryProps) {
  return (
    <View style={styles.card} role="region" aria-label="Selected store">
      <View style={styles.row}>
        <StoreLogo name={name} logoUrl={logoUrl} logoAlt={logoAlt} size={40} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
