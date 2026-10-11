import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorNote, LinkButton, PrimaryButton } from "../src/components/flow/Buttons";
import { CardArt } from "../src/components/flow/CardArt";
import { CheckIcon } from "../src/components/flow/Icons";
import { ProgramLogo } from "../src/components/flow/Logos";
import { pressState } from "../src/components/flow/press-state";
import { Screen } from "../src/components/flow/Screen";
import { SearchField } from "../src/components/flow/SearchField";
import { StepHeader } from "../src/components/flow/StepHeader";
import type { CreditCard } from "../src/lib/api-types";
import { COMMON_CARDS_LABEL, pickCommonCards, searchCards } from "../src/lib/common-cards";
import { programForCard } from "../src/lib/programs";
import { useLayout } from "../src/lib/responsive";
import { colors, fonts } from "../src/lib/theme";
import { useFlow } from "../src/state/flow";

function CardRow({
  card,
  checked,
  onToggle,
  width,
}: {
  card: CreditCard;
  checked: boolean;
  onToggle: () => void;
  width?: number;
}) {
  const { programs } = useFlow();
  const program = programForCard(card, programs);
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={`${card.issuer} ${card.name}, ${program.name}`}
      style={(state) => [
        styles.row,
        width !== undefined && { width },
        pressState(state).hovered && !checked && styles.rowHover,
        checked && styles.rowOn,
      ]}
    >
      <CardArt card={card} width={64} radius={6} />
      <View style={styles.rowText}>
        <Text style={styles.issuer}>{card.issuer}</Text>
        <Text style={styles.cardName}>{card.name}</Text>
        <View style={styles.programLine}>
          <ProgramLogo name={program.name} logoUrl={program.logoUrl} logoAlt={program.logoAlt} />
          <Text style={styles.programName}>{program.name}</Text>
        </View>
      </View>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <CheckIcon size={14} color="#ffffff" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export default function CardsScreen() {
  const router = useRouter();
  const { catalog, loadCatalog, walletIds, toggleCard, programs, location } = useFlow();
  const [query, setQuery] = useState("");
  const layout = useLayout();
  const rowWidth =
    layout.wide && layout.contentWidth !== undefined
      ? Math.floor((layout.contentWidth - GRID_GAP) / 2)
      : undefined;

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const cards = catalog.status === "ready" ? catalog.data : [];
  const owned = useMemo(() => new Set(walletIds), [walletIds]);

  const sections = useMemo(() => {
    const programName = (card: CreditCard) => programForCard(card, programs).name;
    if (query.trim()) {
      return [{ title: "Results", cards: searchCards(cards, query, programName) }];
    }
    const common = pickCommonCards(cards);
    const commonIds = new Set(common.map((c) => c.id));
    const extras = cards.filter((c) => owned.has(c.id) && !commonIds.has(c.id));
    return [
      ...(extras.length ? [{ title: "Your cards", cards: extras }] : []),
      { title: COMMON_CARDS_LABEL, cards: common },
    ];
  }, [cards, programs, query, owned]);

  const count = walletIds.length;
  const cta = count
    ? `Continue with ${count} ${count === 1 ? "card" : "cards"}`
    : "Pick at least one card";

  function next() {
    router.push(location.status === "granted" ? "/store?tab=nearby" : "/location");
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));

  return (
    <Screen
      header={<StepHeader step={1} onBack={back} />}
      footerDivider
      footer={<PrimaryButton label={cta} onPress={next} disabled={count === 0} />}
      step={1}
      actions={{
        onBack: back,
        primary: { label: cta, onPress: next, disabled: count === 0, minWidth: 220 },
      }}
    >
      <View style={[styles.main, layout.wide && styles.mainWide]}>
        <Text
          style={[styles.h1, layout.wide && styles.h1Wide, layout.desktop && styles.h1Desktop]}
          accessibilityRole="header"
        >
          Which cards do you carry?
        </Text>
        <Text style={[styles.lead, layout.wide && styles.leadWide]}>
          Pick them from the list. No card numbers, no bank linking.
        </Text>
        <View style={[styles.search, layout.wide && styles.searchWide]}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search by card or bank"
            accessibilityLabel="Search cards"
          />
        </View>

        {catalog.status === "loading" || catalog.status === "idle" ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading cards…</Text>
          </View>
        ) : catalog.status === "error" ? (
          <View style={styles.state}>
            <ErrorNote>Couldn't load the card list. {catalog.message}</ErrorNote>
            <LinkButton label="Try again" onPress={loadCatalog} />
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionLabel, layout.wide && styles.sectionLabelWide]}>
                {section.title}
              </Text>
              {section.cards.length === 0 ? (
                <Text style={styles.stateText}>
                  No cards match “{query.trim()}”. Try the bank name or the card's
                  rewards program.
                </Text>
              ) : (
                <View style={[styles.list, layout.wide && styles.grid]}>
                  {section.cards.map((card) => (
                    <CardRow
                      key={card.id}
                      card={card}
                      checked={owned.has(card.id)}
                      onToggle={() => toggleCard(card.id)}
                      width={rowWidth}
                    />
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const GRID_GAP = 10;

const styles = StyleSheet.create({
  main: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  mainWide: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  h1: {
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    color: colors.text,
  },
  h1Wide: {
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
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textBody,
  },
  leadWide: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 27,
  },
  search: {
    marginTop: 20,
  },
  searchWide: {
    marginTop: 24,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  sectionLabelWide: {
    marginTop: 24,
  },
  list: {
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 64,
  },
  rowHover: {
    borderColor: colors.primary,
  },
  rowOn: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  issuer: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  cardName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
  },
  programLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  programName: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textBody,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderDashed,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  state: {
    marginTop: 24,
    gap: 12,
    alignItems: "center",
  },
  stateText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
