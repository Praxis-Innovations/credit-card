"use client";

import type { Category } from "@cardcoach/core";
import { CATEGORIES, CATEGORY_LABELS } from "@cardcoach/core";
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
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
              "border-border bg-card text-foreground hover:border-primary/35 hover:bg-muted",
              "data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm",
            )}
          >
            <Icon className="h-4 w-4 opacity-80" />
            {CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
