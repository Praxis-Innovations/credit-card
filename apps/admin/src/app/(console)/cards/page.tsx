import type { Metadata } from "next";
import { CardsConsole } from "@/components/cards/cards-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { loadCatalogCards } from "@/lib/cards/load";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const { supabase } = await requireConsoleSession();
  const { cards, error } = await loadCatalogCards(supabase);

  return <CardsConsole cards={cards} loadError={error} />;
}
