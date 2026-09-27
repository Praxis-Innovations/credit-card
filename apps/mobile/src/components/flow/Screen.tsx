import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, PHONE_COLUMN } from "../../lib/theme";

interface ScreenProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Scroll the body (default true). */
  scroll?: boolean;
  bodyStyle?: ViewStyle;
  /** Top border above the footer (pick-your-cards). */
  footerDivider?: boolean;
  overlay?: ReactNode;
}

/**
 * Phone-first page: header / scrollable body / pinned footer. On wide web
 * screens the whole flow sits in a centered phone-width column.
 */
export function Screen({
  header,
  footer,
  children,
  scroll = true,
  bodyStyle,
  footerDivider,
  overlay,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.column}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollBody, bodyStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, bodyStyle]}>{children}</View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              footerDivider && styles.footerDivider,
              { paddingBottom: Math.max(36, insets.bottom + 16) },
            ]}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom }} />
        )}
      </View>
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: PHONE_COLUMN,
    alignSelf: "center",
  },
  flex: {
    flex: 1,
  },
  scrollBody: {
    flexGrow: 1,
  },
  footer: {
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: colors.bg,
  },
  footerDivider: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
