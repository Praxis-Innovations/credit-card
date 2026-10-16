import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ErrorNote,
  LinkButton,
  OutlineButton,
  PrimaryButton,
} from "../src/components/flow/Buttons";
import { CardArt } from "../src/components/flow/CardArt";
import { EditIcon, StoreIcon } from "../src/components/flow/Icons";
import { StoreLogo } from "../src/components/flow/Logos";
import { pressState } from "../src/components/flow/press-state";
import { Screen } from "../src/components/flow/Screen";
import { StepHeader } from "../src/components/flow/StepHeader";
import { StoreSummary } from "../src/components/flow/StoreSummary";
import { parseAmount } from "../src/lib/amount";
import { CATEGORY_LABELS } from "../src/lib/api-types";
import { categoryPhrase } from "../src/lib/result-copy";
import { useLayout } from "../src/lib/responsive";
import { formatDistance } from "../src/lib/stores";
import { colors, fonts, TOUCH } from "../src/lib/theme";
import { DEFAULT_AMOUNT, useFlow } from "../src/state/flow";

const QUICK_AMOUNTS = [25, 50, 100, 200];

export default function AmountScreen() {
  const router = useRouter();
  const { store, amount, setAmount, walletIds, cardsById, loadCatalog } = useFlow();
  const layout = useLayout();
  const [text, setText] = useState(amount.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  if (!store) return <Redirect href="/store" />;

  const parsed = parseAmount(text);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/store"));

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

  const distance =
    store.distanceMeters !== undefined ? formatDistance(store.distanceMeters) : null;
  const label = CATEGORY_LABELS[store.category];
  const categoryOnly = store.source === "category";
  const meta = [label, distance].filter(Boolean).join(" · ");
  const metaWide = categoryOnly
    ? "Category rates"
    : [label, distance ? `${distance} away` : null].filter(Boolean).join(" · ");

  const input = (
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
      style={[styles.input, layout.desktop && styles.inputDesktop]}
    />
  );

  const quick = (
    <View
      style={[styles.quick, layout.desktop && styles.quickDesktop]}
      role="group"
      aria-label="Quick amounts"
    >
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
              layout.desktop && styles.quickChipDesktop,
              pressState(state).hovered && !on && styles.quickChipHover,
              on && styles.quickChipOn,
            ]}
          >
            <Text style={[styles.quickText, on && styles.quickTextOn]}>${value}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const errorNote = error ? (
    <View style={!layout.desktop && styles.error}>
      <ErrorNote>{error}</ErrorNote>
    </View>
  ) : null;

  const centredAmount = (
    <>
      <View style={[styles.amountBlock, layout.wide && styles.amountBlockWide]}>
        <Text style={styles.prompt}>How much are you spending?</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollar} aria-hidden>
            $
          </Text>
          {input}
        </View>
      </View>
      <View style={[styles.rule, layout.wide && styles.ruleWide, inputFocused && styles.ruleFocused]} />
      {quick}
      {errorNote}
      <Text style={styles.note}>
        Optional. We'll use $100 if you skip.
      </Text>
    </>
  );

  const changeStoreButton = (
    <OutlineButton
      label="Change store"
      onPress={back}
      icon={<StoreIcon />}
      style={(layout.desktop || !layout.wide) && styles.fullWidth}
    />
  );

  let content;
  if (layout.desktop) {
    const cards = walletIds.map((id) => cardsById.get(id)).filter((c) => c !== undefined);
    content = (
      <View style={styles.wideMain}>
        <View style={styles.titleBlock}>
          <Text style={[styles.h1, styles.h1Desktop]} accessibilityRole="header">
            {categoryOnly
              ? `How much are you spending on ${categoryPhrase(store.category)}?`
              : `How much are you spending at ${store.name}?`}
          </Text>
          <Text style={styles.lead}>
            Optional. It lets us show the real dollars you get back. We use $100 if you skip.
          </Text>
        </View>
        <View style={styles.desktopGrid}>
          <View style={styles.aside} role="region" aria-label="Your purchase">
            <Text style={styles.eyebrow}>Your purchase</Text>
            <View style={styles.storeRow}>
              <StoreLogo
                name={store.name}
                logoUrl={store.logoUrl}
                logoAlt={store.logoAlt}
                size={52}
              />
              <View style={styles.flexText}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeMeta}>{metaWide}</Text>
              </View>
            </View>
            {changeStoreButton}
            <View style={styles.divider} />
            <View style={styles.comparing}>
              <Text style={styles.comparingLabel}>
                Comparing {walletIds.length} {walletIds.length === 1 ? "card" : "cards"}
              </Text>
              {cards.map((card) => (
                <View key={card.id} style={styles.comparingRow}>
                  <CardArt card={card} width={56} chip="gold" radius={4} />
                  <Text style={styles.comparingName}>{card.name}</Text>
                </View>
              ))}
            </View>
            <OutlineButton
              label="Edit cards"
              onPress={() => router.push("/cards")}
              icon={<EditIcon />}
              style={styles.fullWidth}
            />
          </View>
          <View style={styles.amountPanel} role="region" aria-label="Amount">
            <View style={styles.amountField}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={[styles.desktopInputRow, inputFocused && styles.desktopInputRowFocused]}>
                <Text style={[styles.dollar, styles.dollarDesktop]} aria-hidden>
                  $
                </Text>
                {input}
              </View>
            </View>
            <View style={styles.amountField}>
              <Text style={styles.fieldLabel}>Quick amounts</Text>
              {quick}
            </View>
            {errorNote}
          </View>
        </View>
      </View>
    );
  } else if (layout.wide) {
    content = (
      <View style={styles.wideMain}>
        <View style={styles.titleBlock}>
          <Text style={[styles.h1, styles.h1Tablet]} accessibilityRole="header">
            How much are you spending?
          </Text>
          <Text style={styles.lead}>The amount helps us show the real dollars you get back.</Text>
        </View>
        <View style={styles.storeCard} role="region" aria-label="Selected store">
          <StoreLogo name={store.name} logoUrl={store.logoUrl} logoAlt={store.logoAlt} size={48} />
          <View style={styles.flexText}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeMeta}>{metaWide}</Text>
          </View>
          {changeStoreButton}
        </View>
        <View style={styles.tabletPanel} role="region" aria-label="Amount">
          {centredAmount}
        </View>
      </View>
    );
  } else {
    content = (
      <View style={styles.main}>
        <StoreSummary
          name={store.name}
          meta={meta}
          logoUrl={store.logoUrl}
          logoAlt={store.logoAlt}
          action={changeStoreButton}
        />
        {centredAmount}
      </View>
    );
  }

  return (
    <Screen
      header={<StepHeader step={3} onBack={back} />}
      footer={
        <>
          <PrimaryButton label="Show my best card" onPress={submit} />
          <LinkButton label="Skip" height={44} onPress={() => go(DEFAULT_AMOUNT)} />
        </>
      }
      step={3}
      actions={{
        onBack: back,
        tertiary: [{ label: "Skip", onPress: () => go(DEFAULT_AMOUNT) }],
        primary: { label: "Show my best card", onPress: submit, minWidth: 200 },
      }}
    >
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  main: {
    paddingTop: 4,
    paddingHorizontal: 24,
  },
  wideMain: {
    gap: 24,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  titleBlock: {
    gap: 8,
  },
  h1: {
    fontFamily: fonts.heading,
    color: colors.text,
  },
  h1Tablet: {
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.6,
  },
  h1Desktop: {
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -0.72,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 27,
    color: colors.textBody,
  },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  storeName: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
  },
  storeMeta: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  tabletPanel: {
    padding: 32,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  desktopGrid: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  aside: {
    width: 360,
    padding: 24,
    gap: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  comparing: {
    gap: 12,
  },
  comparingLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textBody,
  },
  comparingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  comparingName: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  amountPanel: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 32,
    paddingHorizontal: 36,
    gap: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  amountField: {
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textMuted,
  },
  desktopInputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
  },
  desktopInputRowFocused: {
    borderBottomColor: colors.primary,
  },
  amountBlock: {
    marginTop: 48,
    alignItems: "center",
    gap: 8,
  },
  amountBlockWide: {
    marginTop: 0,
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
  dollarDesktop: {
    fontSize: 44,
  },
  input: {
    width: 220,
    fontFamily: fonts.heading,
    fontSize: 56,
    color: colors.text,
    textAlign: "center",
    padding: 0,
  },
  inputDesktop: {
    flex: 1,
    width: undefined,
    minWidth: 0,
    fontSize: 72,
    lineHeight: 76,
    textAlign: "left",
  },
  rule: {
    marginTop: 8,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  ruleWide: {
    marginTop: 16,
  },
  ruleFocused: {
    backgroundColor: colors.primary,
  },
  quick: {
    marginTop: 20,
    flexDirection: "row",
    gap: 8,
  },
  quickDesktop: {
    marginTop: 0,
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
  quickChipDesktop: {
    height: 48,
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
