import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAllCards,
  fetchLoyaltyPrograms,
  fetchMerchantBrands,
} from "../lib/api-client";
import type {
  CreditCard,
  LoyaltyProgram,
  MerchantBrand,
} from "../lib/api-types";
import { mergeGuestWallet } from "../lib/auth";
import type { GeoPoint } from "../lib/places";
import { loadGuestWallet, saveGuestWallet } from "../lib/storage";
import type { StoreChoice } from "../lib/stores";
import { getSupabaseClient } from "../lib/supabase";

export const DEFAULT_AMOUNT = 100;

type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export type LocationState =
  | { status: "unknown" }
  | { status: "granted"; point: GeoPoint }
  | { status: "denied" | "unavailable" | "services_disabled"; message: string };

interface FlowContextValue {
  hydrated: boolean;
  walletIds: string[];
  setWalletIds: (ids: string[]) => void;
  toggleCard: (id: string) => void;
  catalog: Loadable<CreditCard[]>;
  loadCatalog: () => void;
  cardsById: Map<string, CreditCard>;
  programs: LoyaltyProgram[];
  brands: Loadable<MerchantBrand[]>;
  loadBrands: () => void;
  store: StoreChoice | null;
  setStore: (store: StoreChoice | null) => void;
  amount: number;
  setAmount: (amount: number) => void;
  location: LocationState;
  setLocation: (location: LocationState) => void;
  user: User | null;
  walletSync: "idle" | "syncing" | "saved" | "error";
  walletSyncError: string | null;
  signOut: () => Promise<void>;
}

const FlowContext = createContext<FlowContextValue | null>(null);

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function FlowProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [walletIds, setWalletIdsState] = useState<string[]>([]);
  const walletRef = useRef<string[]>([]);
  const [catalog, setCatalog] = useState<Loadable<CreditCard[]>>({ status: "idle" });
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [brands, setBrands] = useState<Loadable<MerchantBrand[]>>({ status: "idle" });
  const [store, setStore] = useState<StoreChoice | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [location, setLocation] = useState<LocationState>({ status: "unknown" });
  const [user, setUser] = useState<User | null>(null);
  const [walletSync, setWalletSync] = useState<FlowContextValue["walletSync"]>("idle");
  const [walletSyncError, setWalletSyncError] = useState<string | null>(null);
  const mergedForUser = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGuestWallet().then((ids) => {
      if (cancelled) return;
      walletRef.current = ids;
      setWalletIdsState(ids);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setWalletIds = useCallback((ids: string[]) => {
    walletRef.current = ids;
    setWalletIdsState(ids);
    void saveGuestWallet(ids);
  }, []);

  const toggleCard = useCallback(
    (id: string) => {
      const current = walletRef.current;
      const adding = !current.includes(id);
      const next = adding ? [...current, id] : current.filter((x) => x !== id);
      setWalletIds(next);

      const supabase = getSupabaseClient();
      if (!supabase || !user) return;
      void (async () => {
        const { error } = adding
          ? await supabase
              .from("user_cards")
              .upsert(
                { user_id: user.id, card_id: id },
                { onConflict: "user_id,card_id", ignoreDuplicates: true },
              )
          : await supabase.from("user_cards").delete().eq("card_id", id);
        if (error) {
          setWalletSync("error");
          setWalletSyncError(error.message);
        }
      })();
    },
    [setWalletIds, user],
  );

  const loadCatalog = useCallback(() => {
    setCatalog((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    void fetchAllCards()
      .then((data) => setCatalog({ status: "ready", data }))
      .catch((err: unknown) =>
        setCatalog((prev) =>
          prev.status === "ready"
            ? prev
            : { status: "error", message: errorMessage(err, "Couldn't load cards.") },
        ),
      );
    void fetchLoyaltyPrograms()
      .then(setPrograms)
      .catch(() => undefined);
  }, []);

  const loadBrands = useCallback(() => {
    setBrands((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    void fetchMerchantBrands()
      .then((data) => setBrands({ status: "ready", data }))
      .catch((err: unknown) =>
        setBrands((prev) =>
          prev.status === "ready"
            ? prev
            : { status: "error", message: errorMessage(err, "Couldn't load stores.") },
        ),
      );
  }, []);

  // Session: pick up an existing session (including one returned in the URL
  // after the Google redirect on web) and follow auth changes.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Once per signed-in user: merge the guest wallet into user_cards.
  useEffect(() => {
    if (!user || !hydrated || mergedForUser.current === user.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    mergedForUser.current = user.id;
    setWalletSync("syncing");
    setWalletSyncError(null);
    void mergeGuestWallet(supabase, user.id, walletRef.current)
      .then((merged) => {
        setWalletIds(merged);
        setWalletSync("saved");
      })
      .catch((err: unknown) => {
        setWalletSync("error");
        setWalletSyncError(errorMessage(err, "Couldn't save your wallet."));
      });
  }, [user, hydrated, setWalletIds]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    mergedForUser.current = null;
    setUser(null);
    setWalletSync("idle");
  }, []);

  const cardsById = useMemo(() => {
    const map = new Map<string, CreditCard>();
    if (catalog.status === "ready") {
      for (const card of catalog.data) map.set(card.id, card);
    }
    return map;
  }, [catalog]);

  const value = useMemo<FlowContextValue>(
    () => ({
      hydrated,
      walletIds,
      setWalletIds,
      toggleCard,
      catalog,
      loadCatalog,
      cardsById,
      programs,
      brands,
      loadBrands,
      store,
      setStore,
      amount,
      setAmount,
      location,
      setLocation,
      user,
      walletSync,
      walletSyncError,
      signOut,
    }),
    [
      hydrated,
      walletIds,
      setWalletIds,
      toggleCard,
      catalog,
      loadCatalog,
      cardsById,
      programs,
      brands,
      loadBrands,
      store,
      amount,
      location,
      user,
      walletSync,
      walletSyncError,
      signOut,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside <FlowProvider>");
  return ctx;
}
