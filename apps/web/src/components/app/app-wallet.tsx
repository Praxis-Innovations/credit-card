"use client";

import { CARDS, groupCardsByIssuer, type CreditCard } from "@northtap/core";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AppWalletProps {
  ownedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  syncHint: string;
}

function feeLabel(card: CreditCard): string {
  return card.annualFee === 0 ? "No fee" : `$${card.annualFee}/yr`;
}

export function AppWallet({
  ownedIds,
  onToggle,
  onClear,
  syncHint,
}: AppWalletProps) {
  const [query, setQuery] = useState("");
  const owned = useMemo(() => new Set(ownedIds), [ownedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CARDS;
    return CARDS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        c.pointCurrency.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => groupCardsByIssuer(filtered), [filtered]);
  const issuers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex h-full min-h-[360px] flex-col gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight text-foreground">
            Your cards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {ownedIds.length}
            </span>{" "}
            selected · {syncHint}
          </p>
        </div>
        {ownedIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issuer, card, or currency…"
          className="pl-10 pr-10"
          aria-label="Search cards"
        />
        {query && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ScrollArea className="h-[min(48vh,440px)] pr-3">
        <div className="space-y-6 pb-2">
          {issuers.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No cards match “{query}”.
            </p>
          )}
          {issuers.map((issuer) => (
            <section key={issuer}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {issuer}
              </h3>
              <ul className="space-y-1.5">
                {(grouped[issuer] ?? []).map((card) => {
                  const checked = owned.has(card.id);
                  return (
                    <li key={card.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors",
                          "hover:bg-muted/70",
                          checked && "border-primary/20 bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggle(card.id)}
                          className="mt-0.5"
                          aria-label={`${card.issuer} ${card.name}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-semibold text-foreground">
                              {card.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {feeLabel(card)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {card.pointCurrency}
                            {card.network ? ` · ${card.network}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
