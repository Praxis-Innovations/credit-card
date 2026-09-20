"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cardcoach:owned-cards";

export function useOwnedCards() {
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          setOwnedIds(parsed);
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ownedIds));
  }, [ownedIds, hydrated]);

  function toggle(id: string) {
    setOwnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function setAll(ids: string[]) {
    setOwnedIds(ids);
  }

  function clear() {
    setOwnedIds([]);
  }

  return { ownedIds, toggle, setAll, clear, hydrated };
}
