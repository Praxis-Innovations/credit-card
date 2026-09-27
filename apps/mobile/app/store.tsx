import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinkButton, PrimaryButton } from "../src/components/flow/Buttons";
import { PinIcon } from "../src/components/flow/Icons";
import { Screen } from "../src/components/flow/Screen";
import { SearchField } from "../src/components/flow/SearchField";
import { StepHeader } from "../src/components/flow/StepHeader";
import { StoreTile, TileGrid } from "../src/components/flow/StoreTile";
import { fetchCategories } from "../src/lib/api-client";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type CategoryInfo,
  type MerchantBrand,
} from "../src/lib/api-types";
import { getForegroundPosition, hasForegroundPermission } from "../src/lib/location";
import { findNearbyPlaces } from "../src/lib/nearby";
import {
  formatDistance,
  normalizeName,
  orderCategories,
  toNearbyStores,
  type NearbyStore,
  type StoreChoice,
} from "../src/lib/stores";
import { colors, fonts, TOUCH } from "../src/lib/theme";
import { useFlow } from "../src/state/flow";

type Tab = "nearby" | "browse";

type NearbyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; stores: NearbyStore[] }
  | { status: "error"; message: string };

/** Offline / API-down fallback: the wire-format category list. */
const FALLBACK_CATEGORIES: CategoryInfo[] = CATEGORIES.map((id) => ({
  id,
  label: CATEGORY_LABELS[id],
}));

function useCategories(): CategoryInfo[] {
  const [categories, setCategories] = useState<CategoryInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchCategories()
      .then((list) => !cancelled && setCategories(list))
      .catch(() => !cancelled && setCategories(FALLBACK_CATEGORIES));
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => orderCategories(categories ?? FALLBACK_CATEGORIES), [categories]);
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist" aria-label="Find a store">
      {(["nearby", "browse"] as const).map((id) => {
        const selected = tab === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            style={[styles.tab, selected && styles.tabOn]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextOn]}>
              {id === "nearby" ? "Nearby" : "Browse"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <Text style={styles.notice} accessibilityRole="alert">
      {children}
    </Text>
  );
}

export default function StoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { brands, loadBrands, location, setLocation, setStore } = useFlow();
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>(params.tab === "browse" ? "browse" : "nearby");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("gas");
  const [nearbyState, setNearby] = useState<NearbyState>({ status: "idle" });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    if (params.tab === "browse" || params.tab === "nearby") setTab(params.tab);
  }, [params.tab]);

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === category)) {
      setCategory(categories[0]!.id);
    }
  }, [categories, category]);

  const brandList: MerchantBrand[] = brands.status === "ready" ? brands.data : [];
  const point = location.status === "granted" ? location.point : null;

  // Returning users who already granted permission: locate without a prompt.
  useEffect(() => {
    if (tab !== "nearby" || location.status !== "unknown") return;
    let cancelled = false;
    void (async () => {
      if (!(await hasForegroundPermission()) || cancelled) return;
      const result = await getForegroundPosition();
      if (cancelled) return;
      setLocation(
        result.ok
          ? { status: "granted", point: result.point }
          : { status: result.reason, message: result.message },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, location.status, setLocation]);

  // Overpass lookup straight from the device; wait for brands so the partner
  // dot is right on first paint (fall back to no dots if brands fail).
  useEffect(() => {
    if (location.status !== "granted") return;
    if (brands.status === "loading" || brands.status === "idle") return;
    let cancelled = false;
    const known = brands.status === "ready" ? brands.data : [];
    setNearby({ status: "loading" });
    void findNearbyPlaces(location.point).then((result) => {
      if (cancelled) return;
      setNearby(
        result.status === "ok"
          ? { status: "ready", stores: toNearbyStores(result.places, known) }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [location, brands]);

  async function locate() {
    setLocating(true);
    const result = await getForegroundPosition();
    setLocating(false);
    setLocation(
      result.ok
        ? { status: "granted", point: result.point }
        : { status: result.reason, message: result.message },
    );
  }

  function choose(store: StoreChoice) {
    setStore(store);
    router.push("/amount");
  }

  function chooseNearby(s: NearbyStore) {
    choose({
      name: s.name,
      merchantQuery: s.merchantQuery,
      category: s.brand?.category ?? s.category,
      logoUrl: s.brand?.logoUrl ?? null,
      logoAlt: s.brand?.logoAlt ?? null,
      distanceMeters: s.distanceMeters,
      partner: Boolean(s.brand),
      source: "nearby",
    });
  }

  function chooseBrand(b: MerchantBrand) {
    choose({
      name: b.name,
      merchantQuery: b.name,
      category: b.category,
      logoUrl: b.logoUrl ?? null,
      logoAlt: b.logoAlt ?? null,
      partner: true,
      source: "browse",
    });
  }

  function chooseCategory(id: Category) {
    choose({
      name: CATEGORY_LABELS[id],
      category: id,
      logoUrl: null,
      logoAlt: null,
      partner: false,
      source: "category",
    });
  }

  const categoryLabel =
    categories.find((c) => c.id === category)?.label ?? CATEGORY_LABELS[category];
  const topStores = brandList.filter((b) => b.category === category);
  const trimmed = query.trim();

  const search = useMemo(() => {
    const q = normalizeName(trimmed);
    if (!q) return null;
    const nearbyHits =
      nearbyState.status === "ready"
        ? nearbyState.stores.filter((s) => normalizeName(s.name).includes(q))
        : [];
    const nearbyBrandIds = new Set(nearbyHits.map((s) => s.brand?.id).filter(Boolean));
    const brandHits = brandList.filter(
      (b) => normalizeName(b.name).includes(q) && !nearbyBrandIds.has(b.id),
    );
    return { nearbyHits, brandHits };
  }, [trimmed, nearbyState, brandList]);

  function renderNearby() {
    const nearby = nearbyState;
    if (!point) {
      const denied = location.status !== "unknown";
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>
            {denied
              ? "Location is off, so we can't see stores around you. You can allow it in your settings, or browse instead."
              : "Allow location to see stores around you. It's only used while the app is open."}
          </Text>
          <PrimaryButton
            label={denied ? "Try location again" : "Use my location"}
            onPress={() => void locate()}
            busy={locating}
          />
          <LinkButton label="Browse stores instead" onPress={() => setTab("browse")} />
        </View>
      );
    }
    if (nearby.status === "loading" || nearby.status === "idle") {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Looking around you…</Text>
        </View>
      );
    }
    if (nearby.status === "error" || nearby.stores.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>
            {nearby.status === "error"
              ? "We couldn't look up stores around you right now."
              : "We didn't find any shops or gas stations close by."}{" "}
            Browse or search for your store instead.
          </Text>
          <LinkButton label="Browse stores" onPress={() => setTab("browse")} />
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <View style={styles.aroundRow}>
          <PinIcon />
          <Text style={styles.aroundText}>Around you · </Text>
          <View style={styles.legendDot} />
          <Text style={styles.aroundText}>has a card partnership</Text>
        </View>
        <TileGrid>
          {nearby.stores.map((s) => (
            <StoreTile
              key={s.id}
              name={s.name}
              meta={formatDistance(s.distanceMeters)}
              logoUrl={s.brand?.logoUrl}
              logoAlt={s.brand?.logoAlt}
              partner={Boolean(s.brand)}
              onPress={() => chooseNearby(s)}
            />
          ))}
        </TileGrid>
      </View>
    );
  }

  function renderBrowse() {
    return (
      <View style={styles.browse}>
        {location.status !== "unknown" && location.status !== "granted" ? (
          <View style={styles.padded}>
            <Notice>Location is off, so pick your store here.</Notice>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          role="group"
          aria-label="Categories"
        >
          {categories.map((c) => {
            const on = c.id === category;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                aria-pressed={on}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {brands.status === "loading" ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : topStores.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Partner stores for {categoryLabel}</Text>
            <View style={styles.padded}>
              <TileGrid>
                {topStores.map((b) => (
                  <StoreTile
                    key={b.id}
                    name={b.name}
                    meta={CATEGORY_LABELS[b.category]}
                    logoUrl={b.logoUrl}
                    logoAlt={b.logoAlt}
                    partner
                    onPress={() => chooseBrand(b)}
                  />
                ))}
              </TileGrid>
            </View>
            <LinkButton
              label={`Not listed? Use ${categoryLabel} rates`}
              onPress={() => chooseCategory(category)}
              height={44}
            />
          </>
        ) : (
          <View style={styles.padded}>
            <PrimaryButton
              label={`Use ${categoryLabel} rates`}
              onPress={() => chooseCategory(category)}
            />
          </View>
        )}
      </View>
    );
  }

  function renderSearch() {
    if (!search) return null;
    const { nearbyHits, brandHits } = search;
    return (
      <View style={styles.section}>
        {nearbyHits.length + brandHits.length > 0 ? (
          <TileGrid>
            {nearbyHits.map((s) => (
              <StoreTile
                key={s.id}
                name={s.name}
                meta={formatDistance(s.distanceMeters)}
                logoUrl={s.brand?.logoUrl}
                logoAlt={s.brand?.logoAlt}
                partner={Boolean(s.brand)}
                onPress={() => chooseNearby(s)}
              />
            ))}
            {brandHits.map((b) => (
              <StoreTile
                key={b.id}
                name={b.name}
                meta={CATEGORY_LABELS[b.category]}
                logoUrl={b.logoUrl}
                logoAlt={b.logoAlt}
                partner
                onPress={() => chooseBrand(b)}
              />
            ))}
          </TileGrid>
        ) : (
          <Text style={styles.stateText}>No partner stores match “{trimmed}”.</Text>
        )}
        <LinkButton
          label={`Use “${trimmed}” with ${categoryLabel} rates`}
          onPress={() =>
            choose({
              name: trimmed,
              merchantQuery: trimmed,
              category,
              logoUrl: null,
              logoAlt: null,
              partner: false,
              source: "search",
            })
          }
        />
      </View>
    );
  }

  return (
    <Screen
      header={
        <StepHeader
          step={3}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/cards"))}
        />
      }
    >
      <View style={styles.top}>
        <Text style={styles.h1} accessibilityRole="header">
          Where are you shopping?
        </Text>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search any store"
          accessibilityLabel="Search stores"
        />
        <Tabs tab={tab} onChange={setTab} />
      </View>
      <View style={styles.body}>
        {search ? renderSearch() : tab === "nearby" ? renderNearby() : renderBrowse()}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingTop: 4,
    paddingHorizontal: 20,
    gap: 14,
  },
  h1: {
    marginHorizontal: 4,
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.52,
    color: colors.text,
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.segmentBg,
  },
  tab: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: {
    backgroundColor: colors.card,
    shadowColor: "#141816",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textMuted,
  },
  tabTextOn: {
    color: colors.text,
  },
  body: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 20,
    gap: 10,
  },
  padded: {
    paddingHorizontal: 20,
  },
  aroundRow: {
    marginHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aroundText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginRight: -2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  browse: {
    gap: 14,
  },
  chips: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    minHeight: TOUCH,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  chipTextOn: {
    color: colors.primaryFg,
  },
  sectionLabel: {
    marginHorizontal: 24,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  stateBox: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  stateText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  notice: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
    backgroundColor: colors.tint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
