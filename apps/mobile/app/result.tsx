import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NorthTapLogo } from "../src/components/brand/NorthTapLogo";
import { ErrorNote, InlineAction, LinkButton } from "../src/components/flow/Buttons";
import { CardArt } from "../src/components/flow/CardArt";
import { InfoIcon } from "../src/components/flow/Icons";
import { SaveWalletSheet } from "../src/components/flow/SaveWalletSheet";
import { Screen } from "../src/components/flow/Screen";
import { StoreSummary } from "../src/components/flow/StoreSummary";
import {
  CATEGORY_LABELS,
  type LoyaltyProgram,
  type Partnership,
  type RecommendationItem,
  type RecommendationResponse,
} from "../src/lib/api-types";
import { loadLastRecommendation } from "../src/lib/last-recommendation-cache";
import { markOnboardingComplete } from "../src/lib/onboarding";
import { loadPartnership } from "../src/lib/partnerships";
import { programForCurrency } from "../src/lib/programs";
import { requestRecommendation } from "../src/lib/recommend";
import {
  assumptionsNote,
  formatAmountShort,
  formatCad,
  formatVerifiedDate,
  otherCardSubtitle,
} from "../src/lib/result-copy";
import { colors, fonts } from "../src/lib/theme";
import { useFlow } from "../src/state/flow";

type ResultState =
  | { status: "loading" }
  | { status: "ready"; response: RecommendationResponse; stale: boolean }
  | { status: "error"; message: string }
  | { status: "empty" };

function ExternalLink({ url, label }: { url: string; label: string }) {
  const webProps =
    Platform.OS === "web"
      ? ({ href: url, hrefAttrs: { target: "_blank", rel: "noopener noreferrer" } } as object)
      : {};
  return (
    <Text
      accessibilityRole="link"
      style={styles.link}
      onPress={Platform.OS === "web" ? undefined : () => void Linking.openURL(url)}
      {...webProps}
    >
      {label}
    </Text>
  );
}

/** Program logo beside a points line, only when the API has a real logo. */
function BreakdownLogo({
  currency,
  programs,
}: {
  currency: string | undefined;
  programs: LoyaltyProgram[];
}) {
  if (!currency) return null;
  const program = programForCurrency(currency, programs);
  if (!program.logoUrl) return null;
  return (
    <Image
      source={{ uri: program.logoUrl }}
      accessibilityLabel={program.logoAlt ?? program.name}
      resizeMode="contain"
      style={styles.breakdownLogo}
    />
  );
}

function BestCard({
  rec,
  amountCad,
  category,
  fuelGrade,
  partnership,
  programs,
}: {
  rec: RecommendationItem;
  amountCad: number;
  category: RecommendationResponse["purchase"]["category"];
  fuelGrade: RecommendationResponse["purchase"]["fuelGrade"];
  partnership: Partnership | null;
  programs: LoyaltyProgram[];
}) {
  const note = assumptionsNote({
    assumptions: rec.assumptions,
    breakdown: rec.valueBreakdown,
    category,
    fuelGrade,
  });
  const verifiedDate = partnership?.lastVerified ?? rec.card.lastVerified;
  return (
    <View style={styles.best} accessibilityLabel="Best card" role="region">
      <Text style={styles.eyebrow}>Tap this card</Text>
      <View style={styles.bestCardRow}>
        <CardArt card={rec.card} width={112} chip="gold" shadow radius={6} />
        <View style={styles.bestCardText}>
          <Text style={styles.bestIssuer}>{rec.card.issuer}</Text>
          <Text style={styles.bestName} accessibilityRole="header">
            {rec.card.name}
          </Text>
        </View>
      </View>
      <View style={styles.headline} accessibilityLiveRegion="polite">
        <Text style={styles.headlineAmount}>{formatCad(rec.estimatedRewardCad)}</Text>
        <Text style={styles.headlineText}>back on your {formatAmountShort(amountCad)}</Text>
      </View>

      {rec.valueBreakdown && rec.valueBreakdown.length > 0 ? (
        <View style={styles.breakdown} accessibilityRole="list">
          {rec.valueBreakdown.map((line, index) => (
            <View key={`${line.kind}-${index}`} style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <BreakdownLogo currency={line.pointCurrency} programs={programs} />
                <Text style={styles.breakdownLabel}>{line.label}</Text>
              </View>
              <Text style={styles.breakdownAmount}>{formatCad(line.amountCad)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.breakdownLabel}>{rec.reason}</Text>
      )}

      {note ? <Text style={styles.assumptions}>{note}</Text> : null}

      {rec.usedPartnership && partnership?.requirements ? (
        <View style={styles.warn} accessibilityRole="alert">
          <InfoIcon />
          <Text style={styles.warnText}>
            <Text style={styles.warnStrong}>Before you pay: </Text>
            {partnership.requirements}
          </Text>
        </View>
      ) : null}

      <Text style={styles.verified}>
        Verified {formatVerifiedDate(verifiedDate)}
        {partnership?.sourceUrl ? (
          <>
            {" · "}
            <ExternalLink url={partnership.sourceUrl} label="View source" />
          </>
        ) : null}
      </Text>
    </View>
  );
}

function OtherCard({ rec }: { rec: RecommendationItem }) {
  return (
    <View
      style={styles.other}
      accessible
      accessibilityLabel={`${rec.card.name}, ${formatCad(rec.estimatedRewardCad)} back`}
    >
      <CardArt card={rec.card} width={56} chip="gold" shadow radius={4} />
      <View style={styles.otherText}>
        <Text style={styles.otherName}>{rec.card.name}</Text>
        <Text style={styles.otherSub}>{otherCardSubtitle(rec)}</Text>
      </View>
      <View style={styles.otherValue}>
        <Text style={styles.otherAmount}>{formatCad(rec.estimatedRewardCad)}</Text>
        <Text style={styles.otherBack}>back</Text>
      </View>
    </View>
  );
}

export default function ResultScreen() {
  const router = useRouter();
  const {
    hydrated,
    store,
    amount,
    walletIds,
    programs,
    loadCatalog,
    user,
    walletSync,
    walletSyncError,
    signOut,
  } = useFlow();
  const [state, setState] = useState<ResultState>({ status: "loading" });
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const run = useCallback(async () => {
    setState({ status: "loading" });
    if (!store) {
      // e.g. back from the Google redirect on web: show the last result.
      const cached = await loadLastRecommendation();
      setState(
        cached ? { status: "ready", response: cached, stale: false } : { status: "empty" },
      );
      return;
    }
    const result = await requestRecommendation({
      amountCad: amount,
      category: store.category,
      merchantQuery: store.merchantQuery,
      ownedCardIds: walletIds,
      fuelGrade: "regular",
      limit: 10,
    });
    if ("error" in result) {
      setState({ status: "error", message: result.error.message });
      return;
    }
    const { stale, ...response } = result;
    setState({ status: "ready", response, stale: Boolean(stale) });
    void markOnboardingComplete();
  }, [store, amount, walletIds]);

  useEffect(() => {
    if (!hydrated) return;
    void run();
  }, [hydrated, run]);

  const best = state.status === "ready" ? state.response.recommendations[0] : undefined;

  useEffect(() => {
    if (!best?.usedPartnership || !best.partnershipId) return;
    let cancelled = false;
    void loadPartnership(best.partnershipId).then((p) => {
      if (!cancelled) setPartnership(p);
    });
    return () => {
      cancelled = true;
    };
  }, [best?.usedPartnership, best?.partnershipId]);

  if (hydrated && walletIds.length === 0 && !user) return <Redirect href="/cards" />;
  if (state.status === "empty") return <Redirect href="/store" />;

  const purchase = state.status === "ready" ? state.response.purchase : null;
  const useLive = state.status === "ready" && !state.stale && store;
  const storeName = useLive
    ? store.name
    : purchase?.merchant ?? (purchase ? CATEGORY_LABELS[purchase.category] : store?.name ?? "");
  const storeLogo = useLive
    ? store.logoUrl ?? purchase?.merchantBrand?.logoUrl
    : purchase?.merchantBrand?.logoUrl;
  const shownAmount = purchase?.amountCad ?? amount;
  const shownCategory = purchase?.category ?? store?.category ?? "other";
  const others = state.status === "ready" ? state.response.recommendations.slice(1) : [];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <NorthTapLogo size={20} accessibilityRole="image" />
          <InlineAction
            label="New search"
            onPress={() => router.dismissTo("/store")}
            accessibilityLabel="New search"
          />
        </View>
      }
      overlay={
        <SaveWalletSheet
          visible={sheetOpen}
          cardCount={walletIds.length}
          onClose={() => setSheetOpen(false)}
        />
      }
    >
      <View style={styles.main}>
        {state.status === "ready" && state.stale ? (
          <View style={styles.stale} accessibilityRole="alert">
            <Text style={styles.staleText}>
              <Text style={styles.warnStrong}>You're offline. </Text>
              This is your last result and may be out of date.
            </Text>
          </View>
        ) : null}

        <View style={styles.storeRow}>
          <StoreSummary
            variant="plain"
            name={storeName}
            meta={`${CATEGORY_LABELS[shownCategory]} · ${formatCad(shownAmount)}`}
            logoUrl={storeLogo}
            actionLabel="Edit"
            actionAccessibilityLabel="Edit amount"
            onAction={() =>
              store
                ? router.canGoBack()
                  ? router.back()
                  : router.replace("/amount")
                : router.dismissTo("/store")
            }
          />
        </View>

        {state.status === "loading" ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Comparing your cards…</Text>
          </View>
        ) : state.status === "error" ? (
          <View style={styles.errorBox}>
            <ErrorNote>{state.message}</ErrorNote>
            <LinkButton label="Try again" onPress={() => void run()} />
          </View>
        ) : state.status === "ready" && !best ? (
          <View style={styles.errorBox}>
            <ErrorNote>
              None of your cards are in NorthTap's catalog yet, so we can't compare them.
            </ErrorNote>
            <LinkButton label="Edit your cards" onPress={() => router.push("/cards")} />
          </View>
        ) : best && purchase ? (
          <>
            <BestCard
              rec={best}
              amountCad={purchase.amountCad}
              category={purchase.category}
              fuelGrade={purchase.fuelGrade}
              partnership={
                best.usedPartnership && partnership?.id === best.partnershipId ? partnership : null
              }
              programs={programs}
            />
            {others.length > 0 ? (
              <>
                <Text style={styles.othersLabel}>Other cards in your wallet</Text>
                <View style={styles.othersList}>
                  {others.map((rec) => (
                    <OtherCard key={rec.card.id} rec={rec} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {state.status === "ready" ? (
          user ? (
            <View style={styles.keep}>
              <View style={styles.keepText}>
                <Text style={styles.keepTitle}>
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
              <InlineAction label="Sign out" onPress={() => void signOut()} />
            </View>
          ) : (
            <View style={styles.keep}>
              <View style={styles.keepText}>
                <Text style={styles.keepTitle}>Keep your wallet</Text>
                <Text style={styles.keepBody}>Save your cards for next time.</Text>
              </View>
              <Pressable
                onPress={() => setSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Save your wallet"
                style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          )
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  main: {
    paddingBottom: 32,
  },
  stale: {
    marginHorizontal: 24,
    marginBottom: 12,
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
  storeRow: {
    marginHorizontal: 24,
  },
  loading: {
    marginTop: 48,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  errorBox: {
    marginTop: 24,
    marginHorizontal: 24,
    gap: 8,
  },
  best: {
    marginTop: 16,
    marginHorizontal: 24,
    padding: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 16,
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
  bestCardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  breakdownLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  breakdownLabel: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textBody,
  },
  breakdownAmount: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  assumptions: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  warn: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: colors.warnBorder,
  },
  warnText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.warnText,
  },
  warnStrong: {
    fontFamily: fonts.semibold,
  },
  verified: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  link: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
  othersLabel: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 24,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textBody,
  },
  othersList: {
    marginHorizontal: 24,
    gap: 8,
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
  otherText: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 16,
    marginHorizontal: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.tint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  keepText: {
    flex: 1,
  },
  keepTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  keepBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  saveButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.primaryFg,
  },
});
