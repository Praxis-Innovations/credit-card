"use client";

import type { Category } from "@northtap/core";
import { CATEGORIES, CATEGORY_LABELS } from "@northtap/core";
import {
  Bus,
  Clapperboard,
  Fuel,
  Globe,
  MoreHorizontal,
  Pill,
  Plane,
  Receipt,
  ShoppingBasket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<Category, LucideIcon> = {
  groceries: ShoppingBasket,
  dining: UtensilsCrossed,
  gas: Fuel,
  transit: Bus,
  drugstore: Pill,
  recurring_bills: Receipt,
  travel: Plane,
  foreign_currency: Globe,
  entertainment: Clapperboard,
  other: MoreHorizontal,
};

interface CategoryPickerProps {
  value: Category | null;
  onChange: (category: Category) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => {
        const Icon = ICONS[category];
        const active = value === category;
        return (
          <button
            key={category}
            type="button"
            data-active={active}
            onClick={() => onChange(category)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
              "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted",
              "active:scale-[0.98]",
              "data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground",
            )}
          >
            <Icon className="h-4 w-4 opacity-80" strokeWidth={1.75} />
            {CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
