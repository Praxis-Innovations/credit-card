import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout } from "../../lib/responsive";
import { colors, fonts } from "../../lib/theme";
import { NorthTapLogo } from "../brand/NorthTapLogo";
import { ActionButton, LinkButton, OutlineButton } from "./Buttons";
import { ChevronLeftIcon } from "./Icons";
import { StepIndicator } from "./StepIndicator";

/** Tablet/desktop bottom bar: Back on the left; tertiary actions, then the primary, on the right. */
export interface ScreenActions {
  onBack?: () => void;
  /** Muted hint shown where the primary would be (or just before it). */
  note?: string;
  tertiary?: Array<{ label: string; onPress: () => void; disabled?: boolean }>;
  primary?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
    arrow?: boolean;
    minWidth?: number;
  };
}

interface ScreenProps {
  /** Phone header (StepHeader or logo bar). */
  header?: ReactNode;
  /** Phone footer (full-width primary button). */
  footer?: ReactNode;
  /** Phone: top border above the footer (pick-your-cards). */
  footerDivider?: boolean;
  /** Tablet/desktop app bar: the 3-step indicator (omitted on intro and result). */
  step?: 1 | 2 | 3;
  /** Tablet/desktop app bar: right-hand slot (result "New search"). */
  appBarAction?: ReactNode;
  /** Tablet/desktop fixed bottom action bar; omit for none. */
  actions?: ScreenActions;
  overlay?: ReactNode;
  children: ReactNode;
}

/**
 * Page shell.
 * Phone (and native): header and footer pinned around the scrolling body.
 * Tablet/desktop web: app bar (logo, step indicator, optional action), the
 * scrolling body in a fixed-width centred column, and a fixed bottom action
 * bar in the same column width. Children keep their place in the tree at every
 * size, so crossing a breakpoint doesn't remount them.
 */
export function Screen({
  header,
  footer,
  footerDivider,
  step,
  appBarAction,
  actions,
  overlay,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { wide, desktop, contentWidth, columnMaxWidth } = useLayout();

  const appBar = wide ? (
    <View
      style={[styles.appBar, desktop ? styles.appBarDesktop : styles.appBarTablet]}
      role="banner"
    >
      <View style={styles.appBarSide}>
        <NorthTapLogo size={22} accessibilityRole="image" />
      </View>
      {step ? <StepIndicator step={step} labelled={desktop} /> : null}
      <View style={[styles.appBarSide, styles.appBarEnd]}>{appBarAction}</View>
    </View>
  ) : null;

  const bottom = wide ? (
    actions ? (
      <ActionBar actions={actions} width={contentWidth} />
    ) : null
  ) : footer ? (
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
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {appBar}
      <View style={[styles.column, !wide && columnMaxWidth !== undefined && { maxWidth: columnMaxWidth }]}>
        {wide ? null : header}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.grow}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              wide
                ? [styles.content, desktop ? styles.contentDesktop : styles.contentTablet, { width: contentWidth }]
                : styles.grow
            }
            role={wide ? "main" : undefined}
            testID="screen-content"
          >
            {children}
          </View>
        </ScrollView>
        {bottom}
      </View>
      {overlay}
    </SafeAreaView>
  );
}

function ActionBar({ actions, width }: { actions: ScreenActions; width: number | undefined }) {
  const { onBack, note, tertiary = [], primary } = actions;
  return (
    <View style={styles.actionBar} testID="action-bar">
      <View style={[styles.actionBarInner, { width }]}>
        <View style={styles.actionGroup}>
          {onBack ? (
            <OutlineButton
              label="Back"
              onPress={onBack}
              height={48}
              icon={<ChevronLeftIcon size={18} />}
            />
          ) : null}
        </View>
        <View style={styles.actionGroup}>
          {note ? <Text style={[styles.note, primary && styles.noteBeforePrimary]}>{note}</Text> : null}
          {tertiary.map((action) => (
            <LinkButton
              key={action.label}
              label={action.label}
              onPress={action.onPress}
              disabled={action.disabled}
              strong
            />
          ))}
          {primary ? (
            <ActionButton
              label={primary.label}
              onPress={primary.onPress}
              disabled={primary.disabled}
              busy={primary.busy}
              arrow={primary.arrow}
              minWidth={primary.minWidth}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  appBarTablet: {
    height: 64,
    paddingHorizontal: 32,
  },
  appBarDesktop: {
    height: 72,
    paddingHorizontal: 48,
  },
  appBarSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  appBarEnd: {
    justifyContent: "flex-end",
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
  content: {
    alignSelf: "center",
  },
  contentTablet: {
    paddingVertical: 32,
  },
  contentDesktop: {
    paddingVertical: 40,
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
  actionBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  actionBarInner: {
    alignSelf: "center",
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  noteBeforePrimary: {
    marginRight: 8,
  },
});
