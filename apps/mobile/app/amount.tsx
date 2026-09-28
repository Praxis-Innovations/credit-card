import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ErrorNote, LinkButton, PrimaryButton } from "../src/components/flow/Buttons";
import { pressState } from "../src/components/flow/press-state";
import { Screen } from "../src/components/flow/Screen";
import { StepHeader } from "../src/components/flow/StepHeader";
import { StoreSummary } from "../src/components/flow/StoreSummary";
import { parseAmount } from "../src/lib/amount";
import { CATEGORY_LABELS } from "../src/lib/api-types";
import { formatDistance } from "../src/lib/stores";
import { colors, fonts, TOUCH } from "../src/lib/theme";
import { DEFAULT_AMOUNT, useFlow } from "../src/state/flow";

const QUICK_AMOUNTS = [25, 50, 100, 200];

export default function AmountScreen() {
  const router = useRouter();
  const { store, amount, setAmount } = useFlow();
  const [text, setText] = useState(amount.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  if (!store) return <Redirect href="/store" />;

  const parsed = parseAmount(text);

  function go(value: number) {
    setAmount(value);
    router.push("/result");
  }

  function submit() {
    if (parsed === null) {
      setError("Enter an amount above $0, or tap Skip to use $100.");
      return;
    }
    go(parsed);
  }

  const meta = [
    CATEGORY_LABELS[store.category],
    store.distanceMeters !== undefined ? formatDistance(store.distanceMeters) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen
      header={
        <StepHeader
          step={3}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/store"))}
        />
      }
      footer={
        <>
          <PrimaryButton label="Show my best card" onPress={submit} />
          <LinkButton label="Skip" height={44} onPress={() => go(DEFAULT_AMOUNT)} />
        </>
      }
    >
      <View style={styles.main}>
        <StoreSummary
          name={store.name}
          meta={meta}
          logoUrl={store.logoUrl}
          logoAlt={store.logoAlt}
          actionLabel="Change"
          actionAccessibilityLabel="Change store"
          onAction={() => (router.canGoBack() ? router.back() : router.replace("/store"))}
        />

        <View style={styles.amountBlock}>
          <Text style={styles.prompt}>
            How much are you spending?
          </Text>
          <View style={styles.amountRow}>
            <Text style={styles.dollar} aria-hidden>
              $
            </Text>
            <TextInput
              value={text}
              onChangeText={(value) => {
                setText(value);
                setError(null);
              }}
              onSubmitEditing={submit}
              inputMode="decimal"
              keyboardType="decimal-pad"
              selectTextOnFocus
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              accessibilityLabel="Amount in dollars"
              style={styles.input}
            />
          </View>
        </View>
        <View style={[styles.rule, inputFocused && styles.ruleFocused]} />

        <View style={styles.quick} role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((value) => {
            const on = parsed === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setText(value.toFixed(2));
                  setError(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`$${value}`}
                accessibilityState={{ selected: on }}
                aria-pressed={on}
                style={(state) => [
                  styles.quickChip,
                  pressState(state).hovered && !on && styles.quickChipHover,
                  on && styles.quickChipOn,
                ]}
              >
                <Text style={[styles.quickText, on && styles.quickTextOn]}>${value}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={styles.error}>
            <ErrorNote>{error}</ErrorNote>
          </View>
        ) : null}

        <Text style={styles.note}>Optional. We'll use $100 if you skip.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  main: {
    paddingTop: 4,
    paddingHorizontal: 24,
  },
  amountBlock: {
    marginTop: 48,
    alignItems: "center",
    gap: 8,
  },
  prompt: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  dollar: {
    fontFamily: fonts.heading,
    fontSize: 36,
    color: colors.textMuted,
  },
  input: {
    width: 220,
    fontFamily: fonts.heading,
    fontSize: 56,
    color: colors.text,
    textAlign: "center",
    padding: 0,
  },
  rule: {
    marginTop: 8,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  ruleFocused: {
    backgroundColor: colors.primary,
  },
  quick: {
    marginTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  quickChip: {
    flex: 1,
    height: TOUCH,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipHover: {
    borderColor: colors.primary,
  },
  quickChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  quickTextOn: {
    color: colors.primaryFg,
  },
  error: {
    marginTop: 16,
  },
  note: {
    marginTop: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
  },
});
