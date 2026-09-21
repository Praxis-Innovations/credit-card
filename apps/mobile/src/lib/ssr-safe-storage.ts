import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * AsyncStorage wrapper that no-ops during SSR / static render
 * (window is undefined in Node while Expo exports the web bundle).
 */
export const ssrSafeStorage: SupportedStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === "undefined") return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};
