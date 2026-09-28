import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "../../lib/responsive";
import { colors } from "../../lib/theme";
import { NorthTapLogo } from "../brand/NorthTapLogo";

interface ScreenProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Top border above the footer (pick-your-cards). */
  footerDivider?: boolean;
  overlay?: ReactNode;
  /** Desktop column width override (the result screen uses two columns). */
  desktopMaxWidth?: number;
}

/**
 * Page shell: header / scrollable body / footer in a centred column.
 * Phone (and native): header and footer are pinned around the scrolling body.
 * Tablet/desktop web: the whole page scrolls and the footer follows the
 * content, sticking to the bottom edge when the content is taller than the
 * window; desktop adds the full-width logo bar. `children` keep the same
 * place in the tree at every size, so crossing a breakpoint doesn't remount them.
 */
export function Screen({
  header,
  footer,
  children,
  footerDivider,
  overlay,
  desktopMaxWidth,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { wide, desktop, columnMaxWidth } = useLayout();
  const maxWidth = desktop && desktopMaxWidth ? desktopMaxWidth : columnMaxWidth;
  const footerBlock = footer ? (
    <View
      style={[
        styles.footer,
        footerDivider && styles.footerDivider,
        wide ? styles.footerSticky : { paddingBottom: Math.max(36, insets.bottom + 16) },
      ]}
    >
      {footer}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {desktop ? (
        <View style={styles.appBar} role="banner">
          <NorthTapLogo size={22} accessibilityRole="image" />
        </View>
      ) : null}
      <View style={[styles.column, !wide && maxWidth !== undefined && { maxWidth }]}>
        {wide ? null : header}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={wide ? styles.pageScroll : styles.grow}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.grow,
              wide && [styles.centred, { maxWidth }],
              desktop && styles.centredDesktop,
            ]}
            role={wide ? "main" : undefined}
          >
            {wide ? header : null}
            <View style={!wide && styles.grow}>{children}</View>
            {wide ? footerBlock : null}
          </View>
        </ScrollView>
        {wide ? null : footerBlock ?? <View style={{ height: insets.bottom }} />}
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
  appBar: {
    height: 72,
    paddingHorizontal: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  column: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  flex: {
    flex: 1,
  },
  grow: {
    flexGrow: 1,
  },
  pageScroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  centred: {
    width: "100%",
    alignSelf: "center",
  },
  centredDesktop: {
    paddingTop: 16,
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
  footerSticky: {
    // react-native-web passes `sticky` through to CSS; RN's types don't list it.
    position: "sticky" as ViewStyle["position"],
    bottom: 0,
    paddingBottom: 24,
  },
});
