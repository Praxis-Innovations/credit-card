import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../lib/theme";

export const STEPS = ["Cards", "Location", "Store"] as const;

/**
 * App-bar progress for tablet/desktop: numbered circles joined by lines;
 * desktop also shows each step's name.
 */
export function StepIndicator({ step, labelled }: { step: 1 | 2 | 3; labelled: boolean }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${STEPS.length}`}
      testID="step-indicator"
    >
      {STEPS.map((name, i) => {
        const index = i + 1;
        const reached = index <= step;
        return (
          <Fragment key={name}>
            {i > 0 ? (
              <View
                style={[
                  styles.connector,
                  { width: labelled ? 32 : 16 },
                  reached && styles.connectorOn,
                ]}
              />
            ) : null}
            <View style={styles.step}>
              <View style={[styles.circle, reached && styles.circleOn]}>
                <Text style={[styles.number, reached && styles.numberOn]}>{index}</Text>
              </View>
              {labelled ? (
                <Text
                  style={[
                    styles.label,
                    reached && styles.labelOn,
                    index === step && styles.labelCurrent,
                  ]}
                >
                  {name}
                </Text>
              ) : null}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.segmentBg,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOn: {
    backgroundColor: colors.primary,
  },
  number: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  numberOn: {
    color: colors.primaryFg,
  },
  connector: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  connectorOn: {
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.text,
  },
  labelCurrent: {
    fontFamily: fonts.semibold,
  },
});
