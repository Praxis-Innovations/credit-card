import { Pressable, StyleSheet, View } from "react-native";
import { colors, TOUCH } from "../../lib/theme";
import { ChevronLeftIcon } from "./Icons";

interface StepHeaderProps {
  step: 1 | 2 | 3;
  total?: number;
  onBack: () => void;
}

/** Back button + progress dots (the current step is the wide pill). */
export function StepHeader({ step, total = 3, onBack }: StepHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={4}
      >
        <ChevronLeftIcon />
      </Pressable>
      <View
        style={styles.dots}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => {
          const index = i + 1;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                index <= step && styles.dotDone,
                index === step && styles.dotCurrent,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    paddingLeft: 8,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 22,
  },
  spacer: {
    width: TOUCH,
  },
});
