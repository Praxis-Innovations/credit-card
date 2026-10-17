import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NorthTapLogo } from "../src/components/brand/NorthTapLogo";
import {
  ActionButton,
  ErrorNote,
  IconButton,
  OutlineButton,
} from "../src/components/flow/Buttons";
import { CardArt } from "../src/components/flow/CardArt";
import { ContactlessIcon, EditIcon, SearchIcon, StoreIcon } from "../src/components/flow/Icons";
import { StoreLogo } from "../src/components/flow/Logos";
import { SaveWalletSheet } from "../src/components/flow/SaveWalletSheet";
import { Screen } from "../src/components/flow/Screen";
import {
  CATEGORY_LABELS,
  type Category,
  type LoyaltyProgram,
  type RecommendationItem,
  type RecommendationResponse,
} from "../src/lib/api-types";
import { loadLastRecommendation } from "../src/lib/last-recommendation-cache";
import { markOnboardingComplete } from "../src/lib/onboarding";
import { recommendationRequestFor, requestRecommendation } from "../src/lib/recommend";
import {
  breakdownRows,
  categoryPhrase,
  earnSummary,
  estimateNote,
  formatAmountShort,
  formatCad,
} from "../src/lib/result-copy";
import { useLayout, type Layout } from "../src/lib/responsive";
import type { StoreChoice } from "../src/lib/stores";
import { colors, fonts } from "../src/lib/theme";
import { DEFAULT_AMOUNT, useFlow } from "../src/state/flow";

type ResultState =
  | { status: "loading" }
  | {
      status: "ready";
      response: RecommendationResponse;
      store: StoreChoice | null;
      stale: boolean;
    }
  | { status: "error"; message: string }
  | { status: "empty" };

interface Purchase {
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
  /** True when the user picked a category ("Use Gas rates"), not a store. */
  categoryOnly: boolean;
  category: Category;
  amountCad: number;
}

export default function ResultScreen() {
  const router = useRouter();
  const {
    hydrated,
    authReady,
    store,
    setStore,
    amount,
    setAmount,
    walletIds,
    programs,
    loadCatalog,
    user,
  } = useFlow();
  const layout = useLayout();
  const [state, setState] = useState<ResultState>({ status: "loading" });
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const run = useCallback(async () => {
    setState({ status: "loading" });
    if (!store) {
      // e.g. back from the Google redirect on web: show the last result.
      const cached = await loadLastRecommendation();
      setState(cached ? { status: "ready", ...cached, stale: false } : { status: "empty" });
      return;
    }
    const result = await requestRecommendation(
      recommendationRequestFor(store, amount, walletIds),
      store,
    );
    if ("error" in result) {
      setState({ status: "error", message: result.error.message });
      return;
    }
    setState({ status: "ready", ...result });
    void markOnboardingComplete();
  }, [store, amount, walletIds]);

  useEffect(() => {
    if (!hydrated) return;
    void run();
  }, [hydrated, run]);

  // Wait for authReady so an OAuth return on /result is not treated as a guest.
  if (!hydrated || !authReady) {
    return (
      <Screen>
        <View style={styles.loading} accessibilityLabel="Loading">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }
  // Guest + empty wallet → pick cards; signed-in + empty → store.
  if (walletIds.length === 0 && !user) return <Redirect href="/cards" />;
  if (state.status === "empty") return <Redirect href="/store" />;

  const ready = state.status === "ready" ? state : null;
  const shownStore = ready ? ready.store : store;
  const category =
    ready?.response.purchase.displayCategory ?? store?.category ?? "other";
  const purchase: Purchase = {
    name: shownStore?.name ?? CATEGORY_LABELS[category],
    logoUrl: shownStore?.logoUrl ?? null,
    logoAlt: shownStore?.logoAlt ?? null,
    categoryOnly: !shownStore || shownStore.source === "category",
    category,
    amountCad: ready?.response.purchase.amountCad ?? amount,
  };
  const recs = ready?.response.recommendations ?? [];
  const best = recs[0];

  const changeStore = () => router.dismissTo("/store");
  const changeAmount = () => {
    if (store) {
      if (router.canGoBack()) router.back();
      else router.replace("/amount");
      return;
    }
    if (!shownStore) return changeStore();
    setStore(shownStore);
    router.replace("/amount");
  };
  const newSearch = () => {
    router.dismissTo("/store");
    setAmount(DEFAULT_AMOUNT);
  };

  const newSearchButton = (
    <OutlineButton
      label="New search"
      onPress={newSearch}
      icon={<SearchIcon size={18} color={colors.text} />}
    />
  );

  let body: ReactNode = null;
  if (state.status === "loading") {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Comparing your cards…</Text>
      </View>
    );
  } else if (state.status === "error") {
    body = (
      <View style={styles.errorBox}>
        <ErrorNote>{state.message}</ErrorNote>
        <OutlineButton label="Try again" onPress={() => void run()} style={styles.errorAction} />
      </View>
    );
  } else if (ready && !best) {
    body = (
      <View style={styles.errorBox}>
        <ErrorNote>
          None of your cards are in NorthTap's catalog yet, so we can't compare them.
        </ErrorNote>
        <OutlineButton
          label="Edit your cards"
          onPress={() => router.push("/cards")}
          icon={<EditIcon />}
          style={styles.errorAction}
        />
      </View>
    );
  } else if (best && layout.desktop) {
    body = (
      <>
        <HeroCard rec={best} purchase={purchase} programs={programs} />
        <View style={styles.desktopLower}>
          <CompareTable recs={recs} category={category} programs={programs} />
          <KeepWallet variant="card" cardCount={walletIds.length} onSave={() => setSheetOpen(true)} />
        </View>
      </>
    );
  } else if (best) {
    body = (
      <>
        <BestCard rec={best} purchase={purchase} programs={programs} layout={layout} />
        {recs.length > 1 ? (
          <View style={styles.others} role="region" aria-label="Other cards">
            <Text style={[styles.othersLabel, layout.wide && styles.othersLabelWide]} role="heading">
              Other cards in your wallet
            </Text>
            {recs.slice(1).map((rec) => (
              <OtherCard key={rec.card.id} rec={rec} category={category} programs={programs} />
            ))}
          </View>
        ) : null}
        <KeepWallet
          variant={layout.wide ? "wide" : "phone"}
          cardCount={walletIds.length}
          onSave={() => setSheetOpen(true)}
        />
      </>
    );
  }

  return (
    <Screen
      header={
        <View style={styles.phoneHeader}>
          <NorthTapLogo size={20} accessibilityRole="image" />
          <IconButton accessibilityLabel="New search" onPress={newSearch}>
            <SearchIcon size={20} color={colors.text} />
          </IconButton>
        </View>
      }
      appBarAction={newSearchButton}
      overlay={
        <SaveWalletSheet
          visible={sheetOpen}
          cardCount={walletIds.length}
          onClose={() => setSheetOpen(false)}
        />
      }
    >
      <View style={[styles.main, layout.wide && styles.mainWide]}>
        {ready?.stale ? (
          <View style={styles.stale} accessibilityRole="alert">
            <Text style={styles.staleText}>
              <Text style={styles.strong}>You're offline. </Text>
              This is your last result and may be out of date.
            </Text>
          </View>
        ) : null}
        <PurchaseSummary
          purchase={purchase}
          layout={layout}
          onChangeStore={changeStore}
          onChangeAmount={changeAmount}
        />
        {body}
      </View>
    </Screen>
  );
}

function ChangeButtons({
  onChangeStore,
  onChangeAmount,
  short,
}: {
  onChangeStore: () => void;
  onChangeAmount: () => void;
  /** Phone: "Store" / "Amount", sharing the card width. */
  short?: boolean;
}) {
  return (
    <View style={[styles.changeRow, short && styles.changeRowPhone]}>
      <OutlineButton
        label={short ? "Store" : "Change store"}
        accessibilityLabel="Change store"
        onPress={onChangeStore}
        icon={<StoreIcon />}
        style={short && styles.changeButtonPhone}
      />
      <OutlineButton
        label={short ? "Amount" : "Change amount"}
        accessibilityLabel="Change amount"
        onPress={onChangeAmount}
        icon={<EditIcon />}
        style={short && styles.changeButtonPhone}
      />
    </View>
  );
}

function PurchaseSummary({
  purchase,
  layout,
  onChangeStore,
  onChangeAmount,
}: {
  purchase: Purchase;
  layout: Layout;
  onChangeStore: () => void;
  onChangeAmount: () => void;
}) {
  const label = CATEGORY_LABELS[purchase.category];
  const amount = formatCad(purchase.amountCad);
  const logo = (size: number) => (
    <StoreLogo
      name={purchase.name}
      logoUrl={purchase.logoUrl}
      logoAlt={purchase.logoAlt}
      category={purchase.category}
      size={size}
    />
  );
  const buttons = (
    <ChangeButtons
      onChangeStore={onChangeStore}
      onChangeAmount={onChangeAmount}
      short={!layout.wide}
    />
  );

  if (layout.desktop) {
    return (
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          {logo(56)}
          <View style={styles.flexText}>
            <Text style={styles.title} role="heading" aria-level={1}>
              {purchase.categoryOnly
                ? `Your best card for ${categoryPhrase(purchase.category)}`
                : `Your best card at ${purchase.name}`}
            </Text>
            <Text style={styles.titleSub}>
              {amount} of {categoryPhrase(purchase.category)}
            </Text>
          </View>
        </View>
        {buttons}
      </View>
    );
  }

  if (layout.wide) {
    return (
      <View style={styles.purchaseRow} role="region" aria-label="Your purchase">
        {logo(48)}
        <View style={styles.flexText}>
          <Text style={styles.eyebrowMuted}>Your purchase</Text>
          <Text style={styles.purchaseRowText}>
            {purchase.categoryOnly ? label : `${purchase.name} · ${label}`} · {amount}
          </Text>
        </View>
        {buttons}
      </View>
    );
  }

  return (
    <View style={styles.purchaseCard} role="region" aria-label="Your purchase">
      <View style={styles.purchaseCardTop}>
        {logo(44)}
        <View style={styles.flexText}>
          <Text style={styles.purchaseName}>
            {purchase.name} · {amount}
          </Text>
          <Text style={styles.purchaseMeta}>{label}</Text>
        </View>
      </View>
      {buttons}
    </View>
  );
}

function Breakdown({ rows, ruled }: { rows: ReturnType<typeof breakdownRows>; ruled?: boolean }) {
  return (
    <View style={!ruled && styles.breakdown}>
      {rows.map((row) => (
        <View
          key={row.label}
          style={[styles.breakdownRow, ruled && styles.breakdownRowRuled]}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}`}
        >
          <Text style={[styles.breakdownLabel, row.total && styles.breakdownTotal]}>
            {row.label}
          </Text>
          <Text style={styles.breakdownValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Phone and tablet: the best card with its earn breakdown. */
function BestCard({
  rec,
  purchase,
  programs,
  layout,
}: {
  rec: RecommendationItem;
  purchase: Purchase;
  programs: LoyaltyProgram[];
  layout: Layout;
}) {
  const rows = breakdownRows(rec, {
    category: purchase.category,
    amountCad: purchase.amountCad,
    programs,
  });
  return (
    <View
      style={[styles.best, layout.wide && styles.bestWide]}
      role="region"
      aria-label="Best card"
    >
      <Text style={styles.eyebrow}>Tap this card</Text>
      <View style={styles.bestCardRow}>
        <CardArt card={rec.card} width={112} chip="gold" shadow radius={9} />
        <View style={styles.flexText}>
          <Text style={styles.bestIssuer}>{rec.card.issuer}</Text>
          <Text style={styles.bestName} role="heading" aria-level={1}>
            {rec.card.name}
          </Text>
        </View>
      </View>
      <View style={styles.headline} accessibilityLiveRegion="polite">
        <Text style={styles.headlineAmount}>{formatCad(rec.estimatedRewardCad)}</Text>
        <Text style={styles.headlineText}>
          back on your {formatAmountShort(purchase.amountCad)}
        </Text>
      </View>
      <Breakdown rows={rows} />
      <Text style={styles.note}>{estimateNote(rec, purchase.category)}</Text>
    </View>
  );
}

/** Desktop: large card on the left, "How you get $X" on the right. */
function HeroCard({
  rec,
  purchase,
  programs,
}: {
  rec: RecommendationItem;
  purchase: Purchase;
  programs: LoyaltyProgram[];
}) {
  const reward = formatCad(rec.estimatedRewardCad);
  const rows = breakdownRows(rec, {
    category: purchase.category,
    amountCad: purchase.amountCad,
    programs,
    detailed: true,
  });
  return (
    <View style={styles.hero} role="region" aria-label="Best card">
      <View style={styles.heroLeft}>
        <View style={styles.pill}>
          <ContactlessIcon size={16} color={colors.primary} />
          <Text style={styles.pillText}>Tap this card</Text>
        </View>
        <CardArt card={rec.card} width={300} chip="gold" shadow radius={18} />
        <View>
          <Text style={styles.heroIssuer}>{rec.card.issuer}</Text>
          <Text style={styles.heroName} role="heading" aria-level={2}>
            {rec.card.name}
          </Text>
        </View>
        <View style={styles.headline} accessibilityLiveRegion="polite">
          <Text style={[styles.headlineAmount, styles.heroAmount]}>{reward}</Text>
          <Text style={[styles.headlineText, styles.heroAmountText]}>
            back on your {formatAmountShort(purchase.amountCad)}
          </Text>
        </View>
      </View>
      <View style={styles.heroRight}>
        <Text style={styles.heroHow} role="heading" aria-level={2}>
          How you get {reward}
        </Text>
        <Breakdown rows={rows} ruled />
        <Text style={styles.heroNote}>{estimateNote(rec, purchase.category, true)}</Text>
      </View>
    </View>
  );
}

function OtherCard({
  rec,
  category,
  programs,
}: {
  rec: RecommendationItem;
  category: Category;
  programs: LoyaltyProgram[];
}) {
  return (
    <View
      style={styles.other}
      accessible
      accessibilityLabel={`${rec.card.name}, ${formatCad(rec.estimatedRewardCad)} back`}
    >
      <CardArt card={rec.card} width={56} chip="gold" shadow radius={4} />
      <View style={styles.flexText}>
        <Text style={styles.otherName}>{rec.card.name}</Text>
        <Text style={styles.otherSub}>{earnSummary(rec, category, programs)}</Text>
      </View>
      <View style={styles.otherValue}>
        <Text style={styles.otherAmount}>{formatCad(rec.estimatedRewardCad)}</Text>
        <Text style={styles.otherBack}>back</Text>
      </View>
    </View>
  );
}

/** Desktop: every wallet card for this purchase, the winner marked Best. */
function CompareTable({
  recs,
  category,
  programs,
}: {
  recs: RecommendationItem[];
  category: Category;
  programs: LoyaltyProgram[];
}) {
  return (
    <View style={styles.compare} role="region" aria-label="Compare your cards">
      <Text style={styles.compareCaption}>Compare your cards for this purchase</Text>
      <View role="table" aria-label="Compare your cards for this purchase">
        <View role="row" style={styles.compareHead}>
          <Text role="columnheader" style={[styles.compareTh, styles.colCard]}>
            Card
          </Text>
          <Text role="columnheader" style={[styles.compareTh, styles.colWhy]}>
            Why
          </Text>
          <Text role="columnheader" style={[styles.compareTh, styles.colBack]}>
            You get back
          </Text>
        </View>
        {recs.map((rec, index) => (
          <View key={rec.card.id} role="row" style={styles.compareRow}>
            <View role="cell" style={[styles.colCard, styles.compareCard]}>
              <CardArt card={rec.card} width={48} chip="gold" radius={4} />
              <Text style={styles.compareName}>{rec.card.name}</Text>
              {index === 0 ? (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>Best</Text>
                </View>
              ) : null}
            </View>
            <Text role="cell" style={[styles.compareWhy, styles.colWhy]}>
              {earnSummary(rec, category, programs)}
            </Text>
            <Text
              role="cell"
              style={[styles.compareBack, styles.colBack, index === 0 && styles.compareBackBest]}
            >
              {formatCad(rec.estimatedRewardCad)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function KeepWallet({
  variant,
  cardCount,
  onSave,
}: {
  variant: "phone" | "wide" | "card";
  cardCount: number;
  onSave: () => void;
}) {
  const { user, walletSync, walletSyncError, signOut } = useFlow();
  const card = variant === "card";
  const boxStyle = [
    styles.keep,
    variant === "wide" && styles.keepWide,
    card && styles.keepCard,
  ];

  if (user) {
    return (
      <View style={boxStyle}>
        <View style={styles.flexText}>
          <Text style={[styles.keepTitle, variant !== "phone" && styles.keepTitleWide]}>
            {walletSync === "syncing"
              ? "Saving your wallet…"
              : walletSync === "error"
                ? "Couldn't save your wallet"
                : "Wallet saved"}
          </Text>
          <Text style={styles.keepBody}>
            {walletSync === "error"
              ? walletSyncError
              : `Signed in as ${user.email ?? "your Google account"}.`}
          </Text>
        </View>
        <OutlineButton label="Sign out" onPress={() => void signOut()} />
      </View>
    );
  }

  const body =
    variant === "phone"
      ? "Save your cards for next time."
      : variant === "wide"
        ? "Save your cards to use them on any device."
        : `Save your ${cardCount === 1 ? "card" : `${cardCount} cards`} to use them on any device.`;
  return (
    <View style={boxStyle}>
      <View style={styles.flexText}>
        <Text style={[styles.keepTitle, variant !== "phone" && styles.keepTitleWide]}>
          Keep your wallet
        </Text>
        <Text style={styles.keepBody}>{body}</Text>
      </View>
      <ActionButton
        label={card ? "Save my wallet" : "Save"}
        accessibilityLabel="Save your wallet"
        onPress={onSave}
        minWidth={0}
        style={variant === "phone" ? styles.savePhone : card ? styles.saveCard : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  phoneHeader: {
    height: 68,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  main: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  mainWide: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    gap: 24,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  strong: {
    fontFamily: fonts.semibold,
  },
  stale: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: colors.warnBorder,
  },
  staleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.warnText,
  },
  loading: {
    marginTop: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  errorBox: {
    gap: 12,
  },
  errorAction: {
    alignSelf: "flex-start",
  },
  changeRow: {
    flexDirection: "row",
    gap: 8,
  },
  changeRowPhone: {
    alignSelf: "stretch",
  },
  changeButtonPhone: {
    flex: 1,
    paddingHorizontal: 14,
  },
  purchaseCard: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  purchaseCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  purchaseName: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  purchaseMeta: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textBody,
  },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  eyebrowMuted: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  purchaseRowText: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
  },
  titleLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.6,
    color: colors.text,
  },
  titleSub: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textBody,
  },
  best: {
    padding: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 16,
  },
  bestWide: {
    padding: 24,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.primary,
  },
  bestCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bestIssuer: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textBody,
  },
  bestName: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
  },
  headline: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    columnGap: 10,
  },
  headlineAmount: {
    fontFamily: fonts.heading,
    fontSize: 44,
    lineHeight: 48,
    color: colors.primary,
  },
  headlineText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  breakdown: {
    gap: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  breakdownRowRuled: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  breakdownLabel: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textBody,
  },
  breakdownTotal: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  breakdownValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  hero: {
    flexDirection: "row",
    gap: 40,
    padding: 32,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  heroLeft: {
    width: 420,
    gap: 18,
  },
  heroRight: {
    flex: 1,
    minWidth: 0,
    gap: 16,
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.primary,
  },
  heroIssuer: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 31,
    color: colors.text,
  },
  heroAmount: {
    fontSize: 56,
    lineHeight: 60,
  },
  heroAmountText: {
    fontSize: 17,
  },
  heroHow: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  heroNote: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textBody,
  },
  desktopLower: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  compare: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  compareCaption: {
    paddingBottom: 8,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textBody,
  },
  compareHead: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  compareTh: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  colCard: {
    flex: 3,
    minWidth: 0,
  },
  colWhy: {
    flex: 2,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  colBack: {
    width: 110,
    textAlign: "right",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  compareCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compareName: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  bestBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  bestBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primaryFg,
  },
  compareWhy: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  compareBack: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  compareBackBest: {
    fontFamily: fonts.heading,
  },
  others: {
    gap: 8,
  },
  othersLabel: {
    marginTop: 4,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textBody,
  },
  othersLabelWide: {
    marginTop: 0,
    marginBottom: 2,
    fontSize: 15,
  },
  other: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  otherName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  otherSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textBody,
  },
  otherValue: {
    alignItems: "flex-end",
  },
  otherAmount: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  otherBack: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  keep: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.tint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  keepWide: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 16,
  },
  keepCard: {
    width: 360,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 18,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 16,
  },
  keepTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  keepTitleWide: {
    fontSize: 16,
  },
  keepBody: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  savePhone: {
    height: 44,
    paddingHorizontal: 18,
  },
  saveCard: {
    alignSelf: "stretch",
  },
});
